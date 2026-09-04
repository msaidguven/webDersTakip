-- Bug fix: app/src/lib/parseMixedQuestions.ts içindeki TYPE_ID sabiti "matching" için
-- yanlışlıkla 4 kullanıyordu (question_types tablosunda gerçek id'si 5, 4 ise "classical"
-- kodudur). Sonuç: app/prompt kopyala-yapıştır akışıyla eklenen her eşleştirme sorusu,
-- DB'de question_type_id=4 ("classical") olarak yanlış etiketlenmiş. Öğrenci tarafında soru
-- tipi bu ID'den değil hangi alt tabloda satır olduğuna göre belirlendiği için (bkz.
-- quizQuestions.ts) quiz deneyimi etkilenmedi — ama admin panelindeki "Tip" filtresi/kolonu
-- ve question_type_id ile yapılan her sorgu bu süre boyunca yanlış sonuç veriyordu.
-- Kod tarafı TYPE_ID = 5 olarak düzeltildi (bkz. parseMixedQuestions.ts); bu migration
-- sadece geçmişte yanlış eklenmiş satırları onarır. question_matching_pairs'ta satırı olan
-- ve hâlâ (yanlışlıkla) question_type_id=4 olan sorular hedefleniyor — question_classical'da
-- satırı olanlara dokunulmuyor, gerçek klasik sorular etkilenmez.
UPDATE public.questions
SET question_type_id = 5
WHERE question_type_id = 4
  AND EXISTS (SELECT 1 FROM public.question_matching_pairs mp WHERE mp.question_id = questions.id)
  AND NOT EXISTS (SELECT 1 FROM public.question_classical qc WHERE qc.question_id = questions.id);
