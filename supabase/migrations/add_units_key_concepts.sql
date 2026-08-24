-- TYMM (Türkiye Yüzyılı Maarif Modeli) ünite sayfalarındaki "Anahtar Kavramlar" listesini
-- saklamak için. TYMM aktarım aracı doldurur; içerik/soru üretim promptlarına bağlam
-- olarak eklenebilir.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.units
  add column if not exists key_concepts text[];
