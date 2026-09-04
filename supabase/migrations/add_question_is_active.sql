-- svg_prompt verilip svg_content'i henüz girilmemiş sorular kaydedilirken taslak
-- (is_active=false) olarak eklenip öğrenciden gizlenebilsin, admin SVG'yi ekleyip
-- kaydedince otomatik yayınlanabilsin diye. Mevcut sorular default true ile
-- etkilenmeden kalır (kullanıcı kararı 2026-09-04: sadece yeni eklenenlere uygulanır).
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
