-- Kullanıcı isteği (2026-09-04): AI'ye sorulan soru, cevap üretilmesini beklemeden
-- HEMEN normal bir yorum gibi yayınlansın; AI'nin cevabı geldiğinde de o yoruma bir
-- YANIT olarak eklensin (başka bir kullanıcının yanıtı gibi). Bunun için sorunun
-- kendisi artık /api/rag/ask'ta anında bir question_comments satırı olarak
-- yayınlanıyor; bu kolon o satırın id'sini tutar ki worker (process-queue) cevabı
-- ürettiğinde rag_answers.parent_comment_id'yi doğru şekilde set edebilsin.
alter table public.rag_question_queue add column if not exists comment_id bigint references public.question_comments(id);
