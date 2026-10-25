-- Okuma metni (paragraf) soruları — 1. aşama (2026-10-23). Metin sorudan ayrı tutulur: oynatıcı onu normal
-- kalınlıkta ayrı bir okuma bloğunda, soru kökünü altında gösterir (kökle birlikte kalın basılınca uzun paragraf
-- okunmuyordu). Şimdilik her metne bir soru bağlanır; şema bir metne birden çok soruya (2. aşama: ortak metinli
-- soru grupları) hazırdır, ikinci migration gerekmez.
-- Yazma yalnız servis rolüyle (admin uç noktaları, soru worker'ı); bu yüzden yalnız okuma politikası var.
CREATE TABLE IF NOT EXISTS public.question_passages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_passages_topic_id ON public.question_passages(topic_id);

ALTER TABLE public.question_passages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS question_passages_public_read ON public.question_passages;
CREATE POLICY question_passages_public_read ON public.question_passages FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.question_passages FROM anon, authenticated;

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS passage_id bigint REFERENCES public.question_passages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_questions_passage_id ON public.questions(passage_id) WHERE passage_id IS NOT NULL;

-- Hiçbir soruya bağlı kalmayan metin silinir (soru silinince ya da metni değiştirilince). Silme birden çok RPC'den
-- (soru/konu/ünite, zorla silme) geçtiği için kural tek yerde, tetikleyicide. Metin yazma yetkisi yalnız servis
-- rolünde olduğundan (öğretmen RLS'iyle soru silse bile) SECURITY DEFINER; search_path sabit.
CREATE OR REPLACE FUNCTION public.delete_orphan_question_passage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.passage_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR NEW.passage_id IS DISTINCT FROM OLD.passage_id)
     AND NOT EXISTS (SELECT 1 FROM public.questions WHERE passage_id = OLD.passage_id) THEN
    DELETE FROM public.question_passages WHERE id = OLD.passage_id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_orphan_question_passage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_questions_orphan_passage ON public.questions;
CREATE TRIGGER trg_questions_orphan_passage
  AFTER DELETE OR UPDATE OF passage_id ON public.questions
  FOR EACH ROW
  WHEN (OLD.passage_id IS NOT NULL)
  EXECUTE FUNCTION public.delete_orphan_question_passage();
