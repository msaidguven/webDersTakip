-- 2026-09-14: rag_queue_worker_timeout_fix.sql, pg_net timeout'unu 90sn'ye çıkarmak için
-- 'ai-question-draft-worker' job'ını cron.schedule(...) ile YENİDEN TANIMLADI. cron.schedule
-- aynı isimle çağrılınca job'ın schedule'ını da command'ıyla birlikte tamamen değiştiriyor —
-- bu da 2026-09-12'de 20 dakikaya çıkarılmış olan schedule'ı sessizce '0 * * * *' (saatte bir)
-- değerine geri döndürdü. Kullanıcı bunu saat başı sadece 1 taslak üretilmesinden fark etti.
--
-- Bu dosya sadece schedule'ı 20 dakikaya geri alıyor; command (90sn timeout dahil) olduğu
-- gibi kalıyor — cron.alter_job sadece schedule parametresini günceller.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-question-draft-worker'),
  schedule := '*/20 * * * *'
);
