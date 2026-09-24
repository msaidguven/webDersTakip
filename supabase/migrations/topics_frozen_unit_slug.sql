-- Bir konu farklı bir üniteye taşındığında (ör. arşiv ünitesine), bu sütun taşınmadan
-- ÖNCEKİ ünitenin slug'ını saklar — URL üretimi ve sayfa çözümleme bu değer varsa onu
-- kullanır, konunun canlı/indekslenmiş URL'i taşımadan etkilenmez (bkz. topics.is_archived,
-- supabase/migrations/topics_is_archived.sql — o sadece görünürlüğü kontrol ediyordu, bu
-- ise URL'in kaynağını donduruyor).
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS frozen_unit_slug text;
