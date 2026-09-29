-- "En çok zorlandığın konu" kuralı (2026-09-29, kullanıcı kararı): anasayfa kartı ve İlerlemem
-- sayfası AYNI tanımı kullanır (bkz. app/src/lib/topicMastery.ts MASTERY_RULES):
--   zorlanılan konu = en az 10 soru çözülmüş VE son-cevap doğruluğu %60'ın altında
--   sıralama        = en düşük doğruluk önce, eşitlikte yanlışı çok olan
-- Eskiden salt "son cevabı yanlış soru sayısı" en çok olan konu seçiliyordu — çok soru çözülmüş
-- ama %67 giden konu "en çok zorlandığın" olarak gösterilebiliyordu.
--
-- Dönüş tipine weak_topic_accuracy eklendi (dersler arası seçim de doğruluğa göre yapılsın);
-- OUT sütunları değiştiği için CREATE OR REPLACE yetmez, fonksiyon yeniden oluşturuluyor.
-- Gövde panel_lesson_progress_and_leaderboard_names.sql'deki ile aynı, sadece topic_agg/weakest değişti.

DROP FUNCTION IF EXISTS public.get_my_lesson_progress(bigint);

CREATE FUNCTION public.get_my_lesson_progress(p_grade_id bigint)
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
  weak_topic_wrong integer,
  weak_topic_accuracy integer
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
           COUNT(*) FILTER (WHERE j.solved AND j.correct)::integer AS correct,
           COUNT(*) FILTER (WHERE j.solved)::integer AS solved
    FROM joined j
    GROUP BY j.lesson_id, j.topic_id, j.topic_title, j.unit_slug, j.topic_slug, j.unit_order, j.topic_order
  ),
  weakest AS (
    SELECT DISTINCT ON (ta.lesson_id) ta.*
    FROM topic_agg ta
    WHERE ta.solved >= 10
      AND ta.correct::numeric / ta.solved < 0.6
      AND ta.unit_slug IS NOT NULL AND ta.topic_slug IS NOT NULL
    ORDER BY ta.lesson_id, (ta.correct::numeric / ta.solved), ta.wrong DESC, ta.unit_order, ta.topic_order
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
    w.wrong,
    CASE WHEN w.solved > 0 THEN round(w.correct * 100.0 / w.solved)::integer END
  FROM lessons_in_grade lig
  LEFT JOIN lesson_agg la ON la.lesson_id = lig.id
  LEFT JOIN weakest w ON w.lesson_id = lig.id
  ORDER BY lig.order_no NULLS LAST, lig.name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_lesson_progress(bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_lesson_progress(bigint) TO authenticated;
