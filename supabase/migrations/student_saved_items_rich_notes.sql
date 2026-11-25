-- Ders notlarında çok satırlı madde/ara başlık/kalın kavram biçimlendirmesini koru (2026-11-25).
ALTER TABLE public.student_saved_items
  DROP CONSTRAINT IF EXISTS student_saved_items_excerpt_check;

DO $$
DECLARE
  v_con text;
BEGIN
  FOR v_con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'student_saved_items'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%char_length(excerpt)%'
  LOOP
    EXECUTE format('ALTER TABLE public.student_saved_items DROP CONSTRAINT IF EXISTS %I', v_con);
  END LOOP;
END $$;

ALTER TABLE public.student_saved_items
  ADD CONSTRAINT student_saved_items_excerpt_check
  CHECK (excerpt IS NULL OR char_length(excerpt) BETWEEN 2 AND 1600);

CREATE OR REPLACE FUNCTION public.save_student_item(
  p_kind text,
  p_topic_id bigint DEFAULT NULL,
  p_question_id bigint DEFAULT NULL,
  p_section_heading text DEFAULT NULL,
  p_section_anchor text DEFAULT NULL,
  p_excerpt text DEFAULT NULL,
  p_toggle boolean DEFAULT false
)
RETURNS TABLE (
  item_id bigint,
  is_saved boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_banned boolean;
  v_existing_id bigint;
  v_new_id bigint;
  -- Satır sonlarını (\n) koruyarak yatay fazla boşlukları temizle, ardışık boş satırları teke indir.
  v_clean_excerpt text := NULLIF(
    left(
      btrim(
        regexp_replace(
          regexp_replace(COALESCE(p_excerpt, ''), '[ \t\r]+', ' ', 'g'),
          '\n{3,}',
          E'\n\n',
          'g'
        ),
        E' \t\n\r'
      ),
      1550
    ),
    ''
  );
  v_clean_heading text := NULLIF(left(btrim(COALESCE(p_section_heading, '')), 160), '');
  v_clean_anchor text := NULLIF(regexp_replace(COALESCE(p_section_anchor, ''), '[^A-Za-z0-9_-]', '', 'g'), '');
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.is_banned INTO v_banned FROM public.profiles p WHERE p.id = v_user;
  IF v_banned IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_kind NOT IN ('note', 'topic', 'question') THEN
    RAISE EXCEPTION 'Invalid kind';
  END IF;

  IF p_kind = 'topic' THEN
    IF p_topic_id IS NULL THEN RAISE EXCEPTION 'topic_id required'; END IF;
    SELECT s.id INTO v_existing_id
    FROM public.student_saved_items s
    WHERE s.user_id = v_user AND s.kind = 'topic' AND s.topic_id = p_topic_id;

    IF v_existing_id IS NOT NULL THEN
      IF p_toggle THEN
        DELETE FROM public.student_saved_items WHERE id = v_existing_id;
        RETURN QUERY SELECT v_existing_id, false;
        RETURN;
      END IF;
      RETURN QUERY SELECT v_existing_id, true;
      RETURN;
    END IF;
  ELSIF p_kind = 'question' THEN
    IF p_question_id IS NULL THEN RAISE EXCEPTION 'question_id required'; END IF;
    SELECT s.id INTO v_existing_id
    FROM public.student_saved_items s
    WHERE s.user_id = v_user AND s.kind = 'question' AND s.question_id = p_question_id;

    IF v_existing_id IS NOT NULL THEN
      IF p_toggle THEN
        DELETE FROM public.student_saved_items WHERE id = v_existing_id;
        RETURN QUERY SELECT v_existing_id, false;
        RETURN;
      END IF;
      RETURN QUERY SELECT v_existing_id, true;
      RETURN;
    END IF;
  ELSE
    IF p_topic_id IS NULL OR v_clean_excerpt IS NULL OR char_length(v_clean_excerpt) < 5 THEN
      RAISE EXCEPTION 'Valid topic_id and excerpt required';
    END IF;
    SELECT s.id INTO v_existing_id
    FROM public.student_saved_items s
    WHERE s.user_id = v_user AND s.kind = 'note' AND s.topic_id = p_topic_id AND s.excerpt = v_clean_excerpt
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN QUERY SELECT v_existing_id, true;
      RETURN;
    END IF;
  END IF;

  SELECT COUNT(*)::integer INTO v_count FROM public.student_saved_items WHERE user_id = v_user;
  IF v_count >= 500 THEN
    RAISE EXCEPTION 'Save limit reached';
  END IF;

  INSERT INTO public.student_saved_items (
    user_id, kind, topic_id, question_id, section_heading, section_anchor, excerpt, is_public
  )
  VALUES (
    v_user, p_kind, p_topic_id, p_question_id, v_clean_heading, v_clean_anchor, v_clean_excerpt, true
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, true;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_student_item(text, bigint, bigint, text, text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_student_item(text, bigint, bigint, text, text, text, boolean) TO authenticated;
