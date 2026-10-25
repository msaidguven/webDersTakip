-- Yazılı soruları — MEB konu-soru dağılım tabloları (2026-10-20, yazili_exams.sql'in devamı).
-- ÖDSGM tabloları kazanım (alt madde) değil ÖĞRENME ÇIKTISI kodu (MAT.6.1.1) bazında ve her yazılı için
-- 4-7 SENARYO veriyor (zümre birini seçer). Bu yüzden ilk tasarımdaki exam_outcome_targets (outcome_id
-- bazlı, tek dağılım) yanlış düzeydeydi — boşken kaldırılıyor. Kod topic_learning_outcomes.code ile eşleşir.
-- Kaynak: https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724

DROP TABLE IF EXISTS public.exam_outcome_targets;

CREATE TABLE IF NOT EXISTS public.exam_lo_targets (
  exam_id bigint NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  scenario_no smallint NOT NULL CHECK (scenario_no BETWEEN 1 AND 12),
  lo_code text NOT NULL,
  question_count smallint NOT NULL CHECK (question_count BETWEEN 1 AND 20),
  PRIMARY KEY (exam_id, scenario_no, lo_code)
);

-- Ülke geneli ortak sınav (ör. 2026-2027 6. sınıf matematik 1. yazılı): soru kitapçığı Bakanlıktan gelir,
-- senaryo yoktur; kapsam konu listesiyle (exam_topics) tutulur. exam_date sayfada gösterilir.
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS national boolean NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS exam_date date;

ALTER TABLE public.exam_lo_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_lo_targets_public_read ON public.exam_lo_targets;
CREATE POLICY exam_lo_targets_public_read ON public.exam_lo_targets FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.status = 'published'));

REVOKE ALL ON public.exam_lo_targets FROM anon, authenticated;
GRANT SELECT ON public.exam_lo_targets TO anon, authenticated;
