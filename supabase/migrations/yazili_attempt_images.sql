-- Yazılı denemesinde öğrencinin kâğıt fotoğrafı (2026-10-27): cevap yazıyla ve/veya fotoğrafla verilebilir.
-- Fotoğraf özel (public=false) bir depolama alanında durur; hiçbir storage policy'si yok → istemci doğrudan
-- okuyamaz/yazamaz, yalnız sunucu route'ları (service role) yükler, kısa süreli imzalı adresle gösterir ve
-- yapay zekâ puanlamasında okur. Yol: <user_id>/<attempt_id>/<question_id>.jpg. 90 gün sonra silinir
-- (bkz. yazili_attempt_images_cron.sql, /api/cron/yazili-foto-temizle).
alter table public.yazili_attempt_answers add column if not exists answer_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('yazili-answers', 'yazili-answers', false, 3145728, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];
