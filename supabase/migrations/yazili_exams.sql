-- Yazılı soruları (2026-10-20, bkz. docs/yazili-sorulari-plani.md). Sorular konu bazlı klasik soru
-- olarak mevcut questions tablosunda durur (question_type_id=4); bu tablolar yalnız "hangi yazılıda
-- hangi konular var" ve MEB'in kazanım başına soru sayısını tutar. Adres sınıf/ders slug'ı + dönem/no'dan
-- türetilir, ayrı slug sütunu yok.

CREATE TABLE IF NOT EXISTS public.exams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grade_id bigint NOT NULL REFERENCES public.grades(id) ON DELETE CASCADE,
  lesson_id bigint NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  term smallint NOT NULL CHECK (term IN (1, 2)),
  exam_no smallint NOT NULL CHECK (exam_no IN (1, 2)),
  -- Kapsam haftaları (yıllık plan, outcome_weeks): konu listesinin varsayılanı buradan türetilir.
  week_from smallint NOT NULL CHECK (week_from BETWEEN 1 AND 40),
  week_to smallint NOT NULL CHECK (week_to BETWEEN 1 AND 40),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (week_from <= week_to),
  UNIQUE (grade_id, lesson_id, term, exam_no)
);

CREATE TABLE IF NOT EXISTS public.exam_topics (
  exam_id bigint NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  topic_id bigint NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  order_no smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (exam_id, topic_id)
);
CREATE INDEX IF NOT EXISTS exam_topics_topic_id_idx ON public.exam_topics (topic_id);

-- MEB senaryosundaki kazanım başına soru sayısı. Satır yoksa o kazanım için MEB verisi girilmemiştir
-- (arayüz haftalara orantılı tahmin gösterir ve "tahmin" diye işaretler).
CREATE TABLE IF NOT EXISTS public.exam_outcome_targets (
  exam_id bigint NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  outcome_id bigint NOT NULL REFERENCES public.outcomes(id) ON DELETE CASCADE,
  question_count smallint NOT NULL CHECK (question_count BETWEEN 0 AND 20),
  PRIMARY KEY (exam_id, outcome_id)
);

-- RLS: herkes yalnız yayındaki yazılıları okur; yazma yalnız service role (admin route'ları).
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_outcome_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exams_public_read ON public.exams;
CREATE POLICY exams_public_read ON public.exams FOR SELECT TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS exam_topics_public_read ON public.exam_topics;
CREATE POLICY exam_topics_public_read ON public.exam_topics FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.status = 'published'));

DROP POLICY IF EXISTS exam_outcome_targets_public_read ON public.exam_outcome_targets;
CREATE POLICY exam_outcome_targets_public_read ON public.exam_outcome_targets FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.status = 'published'));

-- Supabase varsayılan olarak anon/authenticated'a tüm yetkileri verir; RLS TRUNCATE'i kapsamaz.
REVOKE ALL ON public.exams, public.exam_topics, public.exam_outcome_targets FROM anon, authenticated;
GRANT SELECT ON public.exams, public.exam_topics, public.exam_outcome_targets TO anon, authenticated;
