-- Klasik soru puanlama ölçütü (rubrik) — 2026-10-21. MEB ortak yazılı esasları her soru için puanlama
-- anahtarı istiyor; model_answer tek doğru cevabı, rubric ise tam / kısmi puan ölçütünü tutar
-- ("Tam puan: … \n Kısmi puan: …"). Eski sorularda boş kalır.
ALTER TABLE public.question_classical ADD COLUMN IF NOT EXISTS rubric text;
