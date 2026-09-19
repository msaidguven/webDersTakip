-- generate-practice-question route'una (geminiQuestionGen.ts) Google'ın geçici 503
-- ("UNAVAILABLE"/yoğunluk) hatasında 5 dakika bekleyip bir kez daha deneme eklendi
-- (kullanıcının 2026-09-19 isteği). Bu, rag_queue_worker_timeout_fix.sql'in çözdüğü AYNI
-- sınıf hataya yeniden düşmemek için pg_net'in kendi zaman aşımını da uzatmayı gerektiriyor:
-- o migration'da pg_net'in timeout_milliseconds'ı (varsayılan 5sn) 90sn'ye çıkarılmıştı,
-- ama pg_net 90sn'de vazgeçip bağlantıyı kapatınca Vercel bunu "istemci bağlantıyı kesti"
-- sayıp fonksiyonu YARIDA KESİYORDU — 5 dakikalık bir bekleme eklenirse fonksiyon 90.
-- saniyede aynı şekilde öldürülür, bekleme hiç tamamlanamaz. Bu yüzden SADECE
-- 'ai-question-draft-worker' için pg_net timeout'u 6 dakikaya (360000ms) çıkarılıyor —
-- 'rag-queue-worker' (process-queue) buna dokunulmuyor, o rota 503-retry'a sahip değil,
-- 90sn'lik mevcut bütçesi yeterli.
select cron.schedule(
  'ai-question-draft-worker',
  '*/20 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 360000
  );
  $$
);
