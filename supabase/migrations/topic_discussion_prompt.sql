-- Konu sonundaki "Düşün ve Yorumla" kutusu — tek doğrusu olmayan, açık uçlu bir kapanış
-- sorusu; var olan konu tartışma sistemine (UnitDiscussion) bağlanıyor, yeni bir yorum
-- sistemi kurmuyoruz (kullanıcının 2026-09-15 isteği). summary_markdown ile aynı desen:
-- eski konularda NULL kalır, sadece bundan sonra üretilen/güncellenen içerikte dolar.
alter table public.topic_contents
  add column if not exists discussion_prompt_markdown text;
