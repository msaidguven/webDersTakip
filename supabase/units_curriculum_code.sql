-- units tablosuna topics.curriculum_code ile aynı amaçla bir kod sütunu ekler.
-- Şu an hiçbir ünite başlığında gömülü kod tespit edilmedi (0/67), ama admin
-- panelindeki "Kod Temizliği" aracının ünite tarafı da çalışabilsin diye
-- ileriye dönük olarak ekleniyor. Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

ALTER TABLE public.units ADD COLUMN IF NOT EXISTS curriculum_code text;
