-- Klasik soru cevap görseli (2026-10-22, plan: docs/yazili-sorulari-plani.md "Cevap görseli"). Çizim isteyen
-- sorularda ("işaretleyiniz / çiziniz / yerleştiriniz / tamamlayınız") cevap anahtarındaki doğru çizim.
-- answer_svg_prompt: AI'nin soruyla aynı çağrıda yazdığı çizim tarifi; answer_svg_content: SVG Soruları
-- sayfasından girilen görsel. Yayını bekletmez (is_active'e bağlı değil); model_answer esas kalır.
ALTER TABLE public.question_classical ADD COLUMN IF NOT EXISTS answer_svg_prompt text;
ALTER TABLE public.question_classical ADD COLUMN IF NOT EXISTS answer_svg_content text;
