-- Haftalık tüm sayfa yenilemesi: pazartesi 03:00 TR (00:00 UTC) (2026-10-10 kullanıcı kararı; önceden
-- pazar 10:00 TR'de günlük SRS cron'unun içinden yapılıyordu). Hobby planda Vercel cron hakkı dolu.
-- ÖNCE /api/cron/weekly-cache-refresh'i içeren kodu deploy edin, SONRA bu dosyayı çalıştırın.
-- Yetki: diğer worker'larla aynı vault sırrı (RAG_QUEUE_WORKER_SECRET).

select cron.unschedule('weekly-cache-refresh')
where exists (select 1 from cron.job where jobname = 'weekly-cache-refresh');

select cron.schedule(
  'weekly-cache-refresh',
  '0 0 * * 1',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/cron/weekly-cache-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
