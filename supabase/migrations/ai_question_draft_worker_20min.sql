-- ai-question-draft-worker job'u 30 dakikada bir (48/gün) çalışıyordu — kullanıcının
-- 2026-09-12 talebiyle 20 dakikada bire (72/gün) çıkarıldı: gateway timeout/JSON parse gibi
-- geçici hatalarla boşa giden çalıştırmaları telafi etmek için kota (20/gün free-tier)
-- daha sık deneme ile daha erken/güvenilir doldurulsun isteniyor.
--
-- cron.alter_job kullanılıyor — sadece schedule'ı değiştirir, mevcut command'a dokunmaz.
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-question-draft-worker'),
  schedule := '*/20 * * * *'
);
