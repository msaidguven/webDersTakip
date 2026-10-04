-- Konuya özgü İÇERİK HEDEFLERİ (2026-10-04, kullanıcı kararı): resmî MEB/TYMM kazanımları
-- (outcomes: öğrenme çıktısının a/b/c süreç bileşenleri) her zaman olduğu gibi kalır ve
-- öğrenciye/öğretmene yalnız onlar gösterilir. Bazı derslerde (Türkçe) resmî maddeler çok genel
-- olduğu için ("T.Y.6.21 a) Yazım kurallarını uygular." dokuz farklı konuda aynı) konu anlatımı ve
-- soru üretimi konuya özgü hedeflerle yönlendiriliyor — bu hedefler BURADA durur, kazanım olarak
-- hiçbir yerde gösterilmez; yalnız içerik/soru üretim prompt'larına girer.
alter table public.topics add column if not exists content_goals text[];

comment on column public.topics.content_goals is
  'Konuya özgü içerik hedefleri (yalnız AI içerik/soru üretiminde kullanılır, kazanım değildir, kullanıcıya gösterilmez). Resmî kazanımlar outcomes tablosundadır.';
