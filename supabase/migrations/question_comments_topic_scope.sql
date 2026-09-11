-- Ders sayfasındaki yorumlar/AI soru-cevapları artık ÜNİTE bazlı değil KONU bazlı
-- gruplanıyor (kullanıcı isteği, 2026-09-11): her konu kendi yorum akışını taşıyor.
-- unit_id sütunları kaldırılmıyor — geriye dönük uyumluluk (eski satırlar, admin
-- panel sorguları) için kalıyor, sadece yeni bir topic_id sütunu ekleniyor. AI'nin
-- @hocam cevap üretimi zaten ders (grade+lesson) genelinde arama yapıyor
-- (bkz. app/api/rag/process-queue), bu değişiklik sadece yorum akışının hangi
-- sayfada/gruplamada gösterileceğini etkiliyor.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.question_comments add column if not exists topic_id bigint references public.topics(id);
create index if not exists idx_question_comments_topic_id on public.question_comments(topic_id);

alter table public.rag_question_queue add column if not exists topic_id bigint references public.topics(id);
create index if not exists idx_rag_question_queue_topic_id on public.rag_question_queue(topic_id);

alter table public.rag_answers add column if not exists topic_id bigint references public.topics(id);
create index if not exists idx_rag_answers_topic_id on public.rag_answers(topic_id);
