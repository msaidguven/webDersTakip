-- Yıllık plandan gelen ünite adlarındaki "N. Öğrenme Alanı: " önekini kaldır (kullanıcı
-- isteği, 2026-09-26). Bugün sadece 6. sınıf Sosyal Bilgiler'deki 6 ünitede var; diğer
-- sınıflarda aynı üniteler zaten öneksiz ("Evimiz Dünya" / evimiz-dunya).
-- Eski adresler middleware.ts'te (LEGACY_UNIT_OGRENME_ALANI) yeni slug'a 308 ile yönlenir.
update public.units
   set title = regexp_replace(title, '^\s*\d+\.\s*Öğrenme Alanı\s*:\s*', ''),
       slug  = regexp_replace(slug, '^\d+-ogrenme-alani-', '')
 where title ~ '^\s*\d+\.\s*Öğrenme Alanı\s*:' or slug ~ '^\d+-ogrenme-alani-';
