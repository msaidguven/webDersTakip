-- Konu PDF önbelleği (2026-10-25, Vercel aktif CPU azaltma): /api/topic-pdf her indirmede
-- headless Chrome açıp PDF'i sıfırdan basıyordu (indirme başına ~3,5 sn CPU, son 12 saatte
-- CPU'nun ~%33'ü). Artık ilk indirmede üretilen PDF burada saklanıyor; dosya adı, PDF'i
-- etkileyen her şeyin (konu verisi + HTML şablonu) hash'i — içerik ya da tasarım değişince
-- yeni dosya üretilir, eskisi silinir (bkz. app/api/topic-pdf/[topicId]/route.ts).
--
-- Özel (public=false): PDF yalnız üyelere açık; route giriş kontrolünden sonra kısa süreli
-- imzalı URL'ye yönlendirir. Okuma/yazma yalnız service role ile, policy gerekmez.
insert into storage.buckets (id, name, public)
values ('topic-pdfs', 'topic-pdfs', false)
on conflict (id) do nothing;
