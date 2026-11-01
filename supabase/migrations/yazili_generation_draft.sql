-- Otomatik yazılı worker'ı iki adım (2026-10-31): üretim + denetim tek çalışmada 238 sn sürdü (Vercel sınırı 300).
-- Taslak burada saklanır; sonraki çalışma yalnız denetleyip yayınlar. Tur sayacı (runs) yalnız yeni taslak
-- üretilecekken artar; bekleyen taslağı olan konu tur sınırına takılmaz ve sırada öne geçer.

ALTER TABLE public.yazili_generation_runs ADD COLUMN IF NOT EXISTS draft jsonb;

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

  SELECT et.topic_id INTO v_topic
  FROM public.exam_topics et
  JOIN public.exams e ON e.id = et.exam_id AND e.status = 'published'
  LEFT JOIN public.yazili_generation_runs r ON r.topic_id = et.topic_id
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
      WHERE q.topic_id = et.topic_id AND c.prompt_version = 1
    ) < 8
  ORDER BY (r.draft IS NOT NULL) DESC, e.exam_date ASC NULLS LAST, e.id, et.order_no
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
