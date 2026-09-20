-- Kısıt kaldırıldı ama zaten oluşturulmuş ünitelerin slug'ları hâlâ eski hatalı
-- "-{lessonId}-{gradeId}" (ya da nadiren "-{lessonId}-{gradeId}-{order}") eklentisini
-- taşıyor (ör. ".../dijital-urun-tasarimi-ve-gelistirme-7-6" — burada lesson_id=7,
-- grade_id=6). Bu migration SADECE bu tam örüntüyle biten slug'lardan o eklentiyi
-- çıkarır — slug'ın geri kalanına (başka noktalama/format farklılıkları olabilir)
-- dokunmuyoruz, sadece bilinen bug'ın izini siliyoruz.
--
-- NOT: bu, zaten yayında/paylaşılmış olabilecek eski ünite URL'lerini DEĞİŞTİRİR —
-- eski linkler (".../...-7-6") bu migration'dan sonra 404 verir, yönlendirme YOK.
-- Kullanıcının 2026-09-21 açık isteği: önce düzeltme, redirect ayrı bir konu.
update public.units
set slug = regexp_replace(slug, '-' || lesson_id::text || '-' || grade_id::text || '(-[0-9]+)?$', '')
where slug ~ ('-' || lesson_id::text || '-' || grade_id::text || '(-[0-9]+)?$');
