-- Kazanımların hafta numaraları (outcome_weeks) MEB'in yıllık plan belgesinden ARDIŞIK
-- geliyor (1, 2, 3... 36 — tatiller için atlama YOK, bkz. app/src/lib/yillikPlan/importer.ts).
-- Yani "9. hafta" takvimde okulun açılışından 9. takvim haftası DEĞİL, 9. öğretim haftası;
-- ara tatil/bayram gibi tatiller takvimde ekstra gün yer kaplar ama bir öğretim haftası
-- numarası TÜKETMEZ. Bu yüzden "hafta N'nin takvimde hangi tarihe denk geldiği" hesabı,
-- N'den önce geçen tüm tatillerin gerçek gün sayısını da eklemek zorunda — bunun için
-- tatillerin (event_type='break') gerçek takvim tarih aralığını bilmemiz gerekiyor;
-- "hafta numarası" bu amaç için anlamsız (o haftada zaten kazanım/ders var).
--
-- special_content / social_activity türleri hâlâ gerçek bir öğretim haftasını işaretlediği
-- için curriculum_week onlarda anlamlı kalıyor — sadece 'break' için opsiyonel hale geliyor.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.special_week_events
  add column if not exists start_date date,
  add column if not exists end_date date;

alter table public.special_week_events
  alter column curriculum_week drop not null;
