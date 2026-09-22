-- "Konu arşivleme": müfredattan çıkarılan ama Google'da sıralaması olduğu için canlıda
-- kalması istenen konular için. is_active (yayında/gizli) ile karışmasın diye AYRI bir
-- bayrak: is_archived=true olan bir konu is_active=true kaldığı sürece kendi sayfasından
-- erişilebilir ve indekslenebilir kalır, sadece normal navigasyondan (ünite sayfası konu
-- listesi, anasayfa, soru bankası, quiz önerileri) gizlenip /farkli-konular sayfasında ve
-- footer'da ayrı gösterilir.
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
