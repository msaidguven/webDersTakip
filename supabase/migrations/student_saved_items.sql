-- Öğrenci ders notları, konu ve soru kaydetme / üye kartında paylaşma sistemi (2026-11-25).
-- Yalnız müfredat içi içerik kaydedilir:
--   'note'     : konu anlatımından seçilen metin pasajı + konu/bölüm bağlantısı
--   'topic'    : kaydedilen/paylaşılan konu
--   'question' : kaydedilen/paylaşılan soru bankası / test sorusu
-- Sınıf, ders, ünite ve konu adları/slug'ları sorgu anında ana tablolardan çözülür (veri tekrarı yok).

CREATE TABLE IF NOT EXISTS public.student_saved_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('note', 'topic', 'question')),
  topic_id bigint REFERENCES public.topics(id) ON DELETE CASCADE,
  question_id bigint REFERENCES public.questions(id) ON DELETE CASCADE,
  section_heading text,
  section_anchor text,
  excerpt text CHECK (excerpt IS NULL OR char_length(excerpt) BETWEEN 2 AND 600),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_saved_items_ref_check CHECK (
    (kind = 'question' AND question_id IS NOT NULL)
    OR (kind IN ('note', 'topic') AND topic_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_saved_topic_uniq
  ON public.student_saved_items (user_id, topic_id)
  WHERE kind = 'topic';

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_saved_question_uniq
  ON public.student_saved_items (user_id, question_id)
  WHERE kind = 'question';

CREATE INDEX IF NOT EXISTS idx_student_saved_user_created
  ON public.student_saved_items (user_id, is_public, created_at DESC);

ALTER TABLE public.student_saved_items ENABLE ROW LEVEL SECURITY;

-- 1) Kaydet / Geri Al (toggle destekli)
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
  v_clean_excerpt text := NULLIF(left(btrim(regexp_replace(COALESCE(p_excerpt, ''), '\s+', ' ', 'g')), 580), '');
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
    -- p_kind = 'note'
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

-- 2) Sil ve Görünürlük Değiştir
CREATE OR REPLACE FUNCTION public.delete_student_item(p_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_deleted integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.student_saved_items WHERE id = p_id AND user_id = v_user;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_student_item(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_student_item(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_student_item_visibility(p_id bigint, p_is_public boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE public.student_saved_items
  SET is_public = COALESCE(p_is_public, true)
  WHERE id = p_id AND user_id = v_user;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_student_item_visibility(bigint, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_student_item_visibility(bigint, boolean) TO authenticated;

-- 3) Konu veya soru sayfasında kayıtlı durumu kontrolü
CREATE OR REPLACE FUNCTION public.get_my_saved_refs(
  p_topic_id bigint DEFAULT NULL,
  p_question_ids bigint[] DEFAULT NULL
)
RETURNS TABLE (
  topic_saved boolean,
  saved_question_ids bigint[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, ARRAY[]::bigint[];
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN p_topic_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.student_saved_items s
        WHERE s.user_id = v_user AND s.kind = 'topic' AND s.topic_id = p_topic_id
      )
    END,
    COALESCE(
      ARRAY(
        SELECT s.question_id
        FROM public.student_saved_items s
        WHERE s.user_id = v_user
          AND s.kind = 'question'
          AND p_question_ids IS NOT NULL
          AND s.question_id = ANY(p_question_ids)
      ),
      ARRAY[]::bigint[]
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_saved_refs(bigint, bigint[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_saved_refs(bigint, bigint[]) TO authenticated;

-- 4) Üye kartı (/uye/<slug>) için paylaşılan/kaydedilen öğeleri sınıf/ders/ünite/konu hiyerarşisiyle getir
CREATE OR REPLACE FUNCTION public.get_public_saved_items(p_slug text)
RETURNS TABLE (
  id bigint,
  kind text,
  grade_name text,
  lesson_name text,
  unit_title text,
  topic_title text,
  section_heading text,
  excerpt text,
  href text,
  is_public boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_viewer uuid := auth.uid();
  v_target uuid;
  v_is_owner boolean := false;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[A-Za-z0-9]{12}$' THEN
    RETURN;
  END IF;

  SELECT p.id INTO v_target
  FROM public.profiles p
  WHERE p.public_slug = p_slug
    AND NOT p.is_banned
    AND p.role IN ('student', 'admin')
    AND (p.public_profile OR (v_viewer IS NOT NULL AND p.id = v_viewer));

  IF v_target IS NULL THEN
    RETURN;
  END IF;

  v_is_owner := (v_viewer IS NOT NULL AND v_viewer = v_target);

  RETURN QUERY
  SELECT
    s.id,
    s.kind,
    g.name AS grade_name,
    l.name AS lesson_name,
    u.title AS unit_title,
    t.title AS topic_title,
    s.section_heading,
    CASE
      WHEN s.kind = 'question' THEN COALESCE(s.excerpt, left(regexp_replace(COALESCE(q.question_text, ''), '\*+', '', 'g'), 280))
      ELSE s.excerpt
    END AS excerpt,
    CASE
      WHEN s.kind = 'question' THEN
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/soru-bankasi/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug || '?soru=' || s.question_id
          ELSE '/soru/' || s.question_id
        END
      ELSE
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug
                 || CASE WHEN s.section_anchor IS NOT NULL AND s.section_anchor <> '' THEN '#' || s.section_anchor ELSE '' END
          ELSE '/ders'
        END
    END AS href,
    s.is_public,
    s.created_at
  FROM public.student_saved_items s
  LEFT JOIN public.questions q ON q.id = s.question_id
  LEFT JOIN public.topics t ON t.id = COALESCE(s.topic_id, q.topic_id)
  LEFT JOIN public.units u ON u.id = t.unit_id
  LEFT JOIN public.lessons l ON l.id = u.lesson_id
  LEFT JOIN public.grades g ON g.id = u.grade_id
  WHERE s.user_id = v_target
    AND (v_is_owner OR s.is_public = true)
  ORDER BY s.created_at DESC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_saved_items(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_saved_items(text) TO anon, authenticated;

-- 5) Kendi profil sayfası (/profil) için kayıtlı öğeler
CREATE OR REPLACE FUNCTION public.get_my_saved_items()
RETURNS TABLE (
  id bigint,
  kind text,
  grade_name text,
  lesson_name text,
  unit_title text,
  topic_title text,
  section_heading text,
  excerpt text,
  href text,
  is_public boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.kind,
    g.name AS grade_name,
    l.name AS lesson_name,
    u.title AS unit_title,
    t.title AS topic_title,
    s.section_heading,
    CASE
      WHEN s.kind = 'question' THEN COALESCE(s.excerpt, left(regexp_replace(COALESCE(q.question_text, ''), '\*+', '', 'g'), 280))
      ELSE s.excerpt
    END AS excerpt,
    CASE
      WHEN s.kind = 'question' THEN
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/soru-bankasi/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug || '?soru=' || s.question_id
          ELSE '/soru/' || s.question_id
        END
      ELSE
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug
                 || CASE WHEN s.section_anchor IS NOT NULL AND s.section_anchor <> '' THEN '#' || s.section_anchor ELSE '' END
          ELSE '/ders'
        END
    END AS href,
    s.is_public,
    s.created_at
  FROM public.student_saved_items s
  LEFT JOIN public.questions q ON q.id = s.question_id
  LEFT JOIN public.topics t ON t.id = COALESCE(s.topic_id, q.topic_id)
  LEFT JOIN public.units u ON u.id = t.unit_id
  LEFT JOIN public.lessons l ON l.id = u.lesson_id
  LEFT JOIN public.grades g ON g.id = u.grade_id
  WHERE s.user_id = v_user
  ORDER BY s.created_at DESC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_saved_items() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_saved_items() TO authenticated;
