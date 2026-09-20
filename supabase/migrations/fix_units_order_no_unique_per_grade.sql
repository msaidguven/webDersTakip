-- units.order_no'nun benzersizliği yanlışlıkla SADECE lesson_id bazında kurulmuştu
-- (units_lesson_id_order_no_key: UNIQUE(lesson_id, order_no)) — ama order_no bir konunun
-- KENDİ SINIFI içindeki sırası, dersin TÜM sınıfları arasında paylaşılan tek bir sayaç
-- değil. Bu yüzden bir dersin 5. sınıfı order_no 1-6'yı kullandıktan sonra AYNI dersin
-- 6. sınıfına yeni bir ünite eklemeye çalışınca (importUnit.ts kendi order_no'sunu
-- lesson_id+grade_id bazında 1'den başlatıyor) "duplicate key" hatası alınıyordu
-- (kullanıcının 2026-09-20 bildirimi: "6. sınıf sosyal"de de aynı hata). Doğrusu
-- UNIQUE(lesson_id, grade_id, order_no) — her sınıf kendi 1,2,3... sırasını kullanabilmeli.
alter table public.units drop constraint if exists units_lesson_id_order_no_key;
alter table public.units add constraint units_lesson_id_grade_id_order_no_key unique (lesson_id, grade_id, order_no);
