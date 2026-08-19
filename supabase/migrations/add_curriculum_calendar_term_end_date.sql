-- Eğitim-öğretim yılının bitiş tarihi. Kazanımlar modalinin gezinme sınırı (toplam takvim
-- haftası) artık ünitelerin bitiş haftasından + özel haftalardan dolaylı tahmin edilmek
-- yerine doğrudan term_start_date ile term_end_date arasındaki gerçek takvim haftası
-- sayısından hesaplanıyor (bkz. app/src/lib/routeParsing.ts:calendarWeeksBetween).
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.curriculum_calendar_settings
  add column if not exists term_end_date date;
