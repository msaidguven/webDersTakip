-- Panel sadeleştirmesi (2026-09-26): üniteler panelden kaldırıldı, her ders tek kartta
-- ilerleme % + toplam/çözülen/doğru/yanlış + "en çok zorlandığın konu" ile gösteriliyor,
-- detay için Soru Bankası'na yönlendiriliyor. Ayrıca panel sıralaması da anasayfadaki gibi
-- kullanıcı adı yerine "Ahmet Y." gösteriyor.

-- 1) Ortak isim biçimi: "Ad S." — tam ad hiçbir zaman fonksiyonlardan dışarı çıkmaz.
--    tr_upper_char / tr_capitalize_first: add_public_weekly_top_students_rpc.sql.
CREATE OR REPLACE FUNCTION public.format_public_name(p_full_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH p AS (
    SELECT regexp_split_to_array(btrim(regexp_replace(COALESCE(p_full_name, ''), '\s+', ' ', 'g')), ' ') AS parts
  )
  SELECT CASE
    WHEN parts[1] = '' THEN 'Öğrenci'
    WHEN cardinality(parts) = 1 THEN public.tr_capitalize_first(parts[1])
    ELSE public.tr_capitalize_first(parts[1]) || ' ' || public.tr_upper_char(left(parts[cardinality(parts)], 1)) || '.'
  END
  FROM p;
$$;

-- 2) Anasayfa listesi ortak biçimi kullansın (davranış aynı, tek kaynak).
CREATE OR REPLACE FUNCTION public.get_public_weekly_top_students(p_limit integer DEFAULT 5)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_questions integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_week_start date := date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
BEGIN
  RETURN QUERY
  WITH weekly_counts AS (
    SELECT a.user_id, COUNT(*)::integer AS total_questions
    FROM public.test_session_answers a
    WHERE a.user_id IS NOT NULL
      AND a.created_at >= (v_week_start::timestamp AT TIME ZONE 'Europe/Istanbul')
      AND a.created_at < ((v_week_start + 7)::timestamp AT TIME ZONE 'Europe/Istanbul')
    GROUP BY a.user_id
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY w.total_questions DESC, w.user_id))::integer,
    public.format_public_name(p.full_name),
    w.total_questions
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE p.role = 'student'
    AND NOT p.is_banned
    AND w.total_questions > 0
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT v_limit;
END;
$function$;

-- 3) Panel sıralaması: username → "Ad S." + sadece öğrenciler (fix_weekly_leaderboard_use_raw_answers.sql'in
--    devamı).
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_week_start date)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_questions integer,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grade_id bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.grade_id INTO v_grade_id FROM public.profiles p WHERE p.id = v_user_id;
  IF v_grade_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH weekly_counts AS (
    SELECT a.user_id, COUNT(*)::integer AS total_questions
    FROM public.test_session_answers a
    WHERE a.user_id IS NOT NULL
      AND (a.created_at AT TIME ZONE 'Europe/Istanbul')::date >= p_week_start
      AND (a.created_at AT TIME ZONE 'Europe/Istanbul')::date < (p_week_start + 7)
    GROUP BY a.user_id
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY w.total_questions DESC, w.user_id))::integer AS rank,
    public.format_public_name(p.full_name) AS display_name,
    w.total_questions,
    (w.user_id = v_user_id) AS is_me
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE p.grade_id = v_grade_id
    AND w.total_questions > 0
    -- Anasayfayla aynı kural: sadece öğrenciler, banlılar hariç — admin/öğretmen test
    -- hesapları öğrencilerin sırasını kaydırmasın. Çağıranın kendi satırı rolü ne olursa
    -- olsun görünür (admin panelde kendini test edebilsin).
    AND ((p.role = 'student' AND NOT p.is_banned) OR w.user_id = v_user_id)
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT 100;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;

-- 4) Panel ders kartları. Soru Bankası'yla BİREBİR aynı tanımlar (bkz. soruBankasiStatus.ts):
--    havuz = aktif ünite → aktif + arşivlenmemiş konu → aktif, klasik olmayan (type<>4) soru;
--    çözülen = user_question_stats'ta total_attempts>0 olan farklı soru;
--    doğru/yanlış = her sorunun SON cevabı (yanlışını düzelten öğrencinin yanlış sayısı düşer).
--    "En çok zorlandığın konu": son cevabı yanlış olan sorusu en fazla konu (eşitlikte
--    başarı oranı düşük olan); hiç yanlışı yoksa NULL.
--    Kullanıcı auth.uid()'den alınır — eski web_get_lessons_with_progress p_user_id alıp
--    anon'a açıktı, yani herkes herkesin ilerlemesini sorgulayabiliyordu (aşağıda kaldırıldı).
CREATE OR REPLACE FUNCTION public.get_my_lesson_progress(p_grade_id bigint)
RETURNS TABLE (
  lesson_id bigint,
  lesson_name text,
  lesson_slug text,
  icon text,
  grade_slug text,
  total_questions integer,
  solved_questions integer,
  correct_answers integer,
  wrong_answers integer,
  weak_topic_title text,
  weak_topic_unit_slug text,
  weak_topic_slug text,
  weak_topic_wrong integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH lessons_in_grade AS (
    SELECT l.id, l.name, l.slug, COALESCE(l.icon, '📘') AS icon, l.order_no
    FROM public.lesson_grades lg
    JOIN public.lessons l ON l.id = lg.lesson_id AND l.is_active
    WHERE lg.grade_id = p_grade_id AND lg.is_active
  ),
  pool AS (
    SELECT u.lesson_id, u.slug AS unit_slug, t.id AS topic_id, t.title AS topic_title, t.slug AS topic_slug, t.order_no AS topic_order, u.order_no AS unit_order, q.id AS question_id
    FROM public.units u
    JOIN public.topics t ON t.unit_id = u.id AND t.is_active AND NOT t.is_archived
    JOIN public.questions q ON q.topic_id = t.id AND q.is_active AND q.question_type_id <> 4
    WHERE u.grade_id = p_grade_id
      AND u.is_active
      AND u.lesson_id IN (SELECT id FROM lessons_in_grade)
  ),
  my_stats AS (
    -- (user_id, question_id, grade_id) unique — aynı soru nadiren iki sınıf altında kayıtlı
    -- olabilir, en son cevap geçerli.
    SELECT DISTINCT ON (s.question_id) s.question_id, s.last_answer_correct
    FROM public.user_question_stats s
    WHERE s.user_id = v_user_id
      AND s.total_attempts > 0
      AND s.question_id IN (SELECT question_id FROM pool)
    ORDER BY s.question_id, s.last_answer_at DESC NULLS LAST
  ),
  joined AS (
    SELECT p.*, m.question_id IS NOT NULL AS solved, COALESCE(m.last_answer_correct, false) AS correct
    FROM pool p
    LEFT JOIN my_stats m ON m.question_id = p.question_id
  ),
  lesson_agg AS (
    SELECT j.lesson_id,
           COUNT(*)::integer AS total,
           COUNT(*) FILTER (WHERE j.solved)::integer AS solved,
           COUNT(*) FILTER (WHERE j.solved AND j.correct)::integer AS correct,
           COUNT(*) FILTER (WHERE j.solved AND NOT j.correct)::integer AS wrong
    FROM joined j
    GROUP BY j.lesson_id
  ),
  topic_agg AS (
    SELECT j.lesson_id, j.topic_title, j.unit_slug, j.topic_slug, j.unit_order, j.topic_order,
           COUNT(*) FILTER (WHERE j.solved AND NOT j.correct)::integer AS wrong,
           COUNT(*) FILTER (WHERE j.solved)::integer AS solved
    FROM joined j
    GROUP BY j.lesson_id, j.topic_id, j.topic_title, j.unit_slug, j.topic_slug, j.unit_order, j.topic_order
  ),
  weakest AS (
    SELECT DISTINCT ON (ta.lesson_id) ta.*
    FROM topic_agg ta
    WHERE ta.wrong > 0 AND ta.unit_slug IS NOT NULL AND ta.topic_slug IS NOT NULL
    ORDER BY ta.lesson_id, ta.wrong DESC, (ta.wrong::numeric / ta.solved) DESC, ta.unit_order, ta.topic_order
  )
  SELECT
    lig.id,
    lig.name,
    lig.slug,
    lig.icon,
    (SELECT g.slug FROM public.grades g WHERE g.id = p_grade_id),
    COALESCE(la.total, 0),
    COALESCE(la.solved, 0),
    COALESCE(la.correct, 0),
    COALESCE(la.wrong, 0),
    w.topic_title,
    w.unit_slug,
    w.topic_slug,
    w.wrong
  FROM lessons_in_grade lig
  LEFT JOIN lesson_agg la ON la.lesson_id = lig.id
  LEFT JOIN weakest w ON w.lesson_id = lig.id
  ORDER BY lig.order_no NULLS LAST, lig.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_lesson_progress(bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_lesson_progress(bigint) TO authenticated;

-- 5) Eski RPC'nin tek kullanıcısı panel ders kartlarıydı (dashboardUnits.ts) — artık yok.
--    p_user_id parametresiyle anon'a açık olduğu için bırakmak güvenlik açığı.
DROP FUNCTION IF EXISTS public.web_get_lessons_with_progress(uuid, bigint);
