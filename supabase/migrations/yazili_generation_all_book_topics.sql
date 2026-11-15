-- Otomatik yazılı worker'ı TÜM kitaplı konulara (kullanıcı kararı 2026-11-03): önceki hâl yalnız YAYINDAKİ yazılıların
-- konularına soru üretiyordu; taslak yazılılar (ör. 5. ve 7. sınıf) hiç soru almıyordu. Artık kitabı (RAG belgesi)
-- yüklü ünitede, ders notu yayında olan her konu sıraya girer; sorular bir yazılının senaryosundaki konuya aitse o
-- yazılıda kendiliğinden görünür.
-- Sıra: bekleyen taslağı olan konu → bir yazılı senaryosunda geçen konular (yayında/taslak fark etmez; en erken
-- dönem-yazılı önce, 1. dönem 1. yazılı en önde) → kalan konular sınıf/ders/ünite/konu sırasıyla.
-- Yeniden deneme / tur / 'skipped' kuralları ve "konu başına 8 v1 soru" eşiği yazili_generation_draft.sql ile aynı.

CREATE OR REPLACE FUNCTION public.claim_next_yazili_topic()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('claim_next_yazili_topic', 0));

  WITH book_topics AS (
    SELECT t.id AS topic_id, g.order_no AS g_ord, l.order_no AS l_ord, u.order_no AS u_ord, t.order_no AS t_ord
    FROM public.topics t
    JOIN public.units u ON u.id = t.unit_id
    JOIN public.grades g ON g.id = u.grade_id
    JOIN public.lessons l ON l.id = u.lesson_id
    WHERE EXISTS (SELECT 1 FROM public.rag_documents rd WHERE rd.unit_id = u.id)
      AND EXISTS (SELECT 1 FROM public.topic_contents c WHERE c.topic_id = t.id AND c.is_published)
  ),
  exam_rank AS (
    SELECT et.topic_id, min(e.term * 10 + e.exam_no) AS rank
    FROM public.exam_topics et
    JOIN public.exams e ON e.id = et.exam_id
    GROUP BY et.topic_id
  )
  SELECT b.topic_id INTO v_topic
  FROM book_topics b
  LEFT JOIN exam_rank x ON x.topic_id = b.topic_id
  LEFT JOIN public.yazili_generation_runs r ON r.topic_id = b.topic_id
  WHERE (
      r.topic_id IS NULL
      OR (
        (r.runs < 3 OR r.draft IS NOT NULL)
        AND r.status <> 'skipped'
        AND (r.status <> 'generating' OR r.claimed_at < now() - interval '10 minutes')
      )
    )
    AND (
      SELECT count(*) FROM public.questions q
      JOIN public.question_classical c ON c.question_id = q.id
      WHERE q.topic_id = b.topic_id AND c.prompt_version = 1
    ) < 8
  ORDER BY (r.draft IS NOT NULL) DESC, x.rank ASC NULLS LAST, b.g_ord, b.l_ord, b.u_ord, b.t_ord
  LIMIT 1;

  IF v_topic IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.yazili_generation_runs (topic_id, status, runs, claimed_at)
  VALUES (v_topic, 'generating', 1, now())
  ON CONFLICT (topic_id) DO UPDATE
    SET status = 'generating',
        runs = public.yazili_generation_runs.runs + CASE WHEN public.yazili_generation_runs.draft IS NULL THEN 1 ELSE 0 END,
        claimed_at = now();

  RETURN v_topic;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_yazili_topic() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_yazili_topic() TO service_role;
