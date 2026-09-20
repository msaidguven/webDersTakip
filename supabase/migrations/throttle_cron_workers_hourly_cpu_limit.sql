-- Vercel Hobby "Fluid Active CPU" limiti aşıldı (4sa/ay, hesap pause riski var —
-- kullanıcının 2026-09-20 isteği). Sık çalışan 3 pg_cron worker'ı saatlik'e düşürüyoruz:
-- rag-queue-worker (@hocam/@kanka canlı soru-cevap, önceden 5 dk'da bir), ve zaten
-- 20 dk'da bir çalışan ai-question-draft-worker / ai-content-draft-worker.
-- cron.alter_job sadece schedule'ı değiştirir, command (endpoint, timeout) aynı kalır.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'rag-queue-worker'),
  schedule := '0 * * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-question-draft-worker'),
  schedule := '0 * * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-content-draft-worker'),
  schedule := '0 * * * *'
);
