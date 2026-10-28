-- Yazılı cevap fotoğraflarını 90 gün sonra siler: her gün 03:30 TR (00:30 UTC).
-- ÖNCE /api/cron/yazili-foto-temizle'yi içeren kodu deploy edin, SONRA bu dosyayı çalıştırın.
-- Yetki: diğer worker'larla aynı vault sırrı (RAG_QUEUE_WORKER_SECRET).
select cron.unschedule('yazili-foto-temizle')
where exists (select 1 from cron.job where jobname = 'yazili-foto-temizle');

select cron.schedule(
  'yazili-foto-temizle',
  '30 0 * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/cron/yazili-foto-temizle',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
