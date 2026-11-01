-- Yazılı soruları v0/v1 + otomatik yazılı worker'ı (2026-10-31).
-- prompt_version: 0 = bu migration'dan önceki bütün klasik sorular; 1 = kısa cevaplı ağırlıklı, net istemli
-- yeni yazılı promptu (admin yazılı kaydı ve worker yazar; bkz. app/src/lib/yazili/common.ts
-- YAZILI_PROMPT_VERSION). Sayfa/kağıt/"Yeni yazılı aç" önce v1'i kullanır.

ALTER TABLE public.question_classical
  ADD COLUMN IF NOT EXISTS prompt_version smallint NOT NULL DEFAULT 0;

-- Worker kuyruğu: yayındaki yazılıların konuları. Konu başına tek satır; runs her kapışta artar, geçici
-- Gemini hatasında geri alınır (hak yanmaz). 'skipped' = konunun kazanımı/kaynağı yok, bir daha denenmez.
CREATE TABLE IF NOT EXISTS public.yazili_generation_runs (
  topic_id bigint PRIMARY KEY REFERENCES public.topics(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('generating', 'idle', 'done', 'failed', 'skipped')),
  runs smallint NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  last_message text
);

-- Yalnız service role (worker) yazar/okur.
ALTER TABLE public.yazili_generation_runs ENABLE ROW LEVEL SECURITY;

-- Sıradaki konu: yayındaki yazılılarda, v1 klasik sorusu 8'den az (TOPIC_QUESTION_TARGET.min), en çok 3 tur
-- denenmiş, şu an üretilmeyen (10 dk'dan eski 'generating' kilidi ölü sayılır). Sınav tarihi en yakın yazılı önce.
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
      OR (r.runs < 3 AND r.status <> 'skipped' AND (r.status <> 'generating' OR r.claimed_at < now() - interval '10 minutes'))
    )
    AND (
      SELECT count(*) FROM public.questions q
      JOIN public.question_classical c ON c.question_id = q.id
      WHERE q.topic_id = et.topic_id AND c.prompt_version = 1
    ) < 8
  ORDER BY e.exam_date ASC NULLS LAST, e.id, et.order_no
  LIMIT 1;

  IF v_topic IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.yazili_generation_runs (topic_id, status, runs, claimed_at)
  VALUES (v_topic, 'generating', 1, now())
  ON CONFLICT (topic_id) DO UPDATE
    SET status = 'generating', runs = public.yazili_generation_runs.runs + 1, claimed_at = now();

  RETURN v_topic;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_yazili_topic() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_yazili_topic() TO service_role;
