-- GitHub Actions'ın zamanlanmış workflow tetikleyicileri bu repo için güvenilir çalışmıyor:
-- kullanıcının 2026-09-09 şikayeti üzerine yapılan incelemede, hem rag-queue-worker.yml
-- (5 dakikada bir olması gereken) hem ai-question-draft-worker.yml (saatte bir olması
-- gereken) GERÇEKTE 2-6 saatte bir tetiklendiği görüldü (GitHub Actions run geçmişi,
-- api.github.com/repos/.../actions/workflows/*/runs ile doğrulandı) — mantık/kota
-- sorunu değil, GitHub'ın scheduled workflow kuyruğunun bu sıklıkta güvenilmez olması.
-- Bu iki worker'ı buraya, Supabase'in kendi pg_cron+pg_net uzantılarına taşıyoruz:
-- veritabanı içinden doğrudan HTTP çağrısı yapıyor, GitHub'ın kuyruğuna bağımlı değil.
-- İki GitHub Actions workflow dosyası bu migration ile birlikte kaldırıldı.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Worker secret'ı (iki route'un da Authorization header kontrolünde beklediği
-- RAG_QUEUE_WORKER_SECRET ile AYNI değer) Vault'a kaydediliyor — düz metin bir GUC
-- (current_setting) yerine, çünkü GUC'lar herhangi bir authenticated role tarafından
-- okunabilir, Vault'taki decrypted_secrets ise sadece service_role/postgres erişimine kapalı.
--
-- ÖNEMLİ — bu dosyayı SQL editor'de çalıştırmadan önce:
-- aşağıdaki 'BURAYA_GERCEK_SECRET_DEGERINI_YAZIN' yerine Vercel'deki/GitHub secret'larındaki
-- gerçek RAG_QUEUE_WORKER_SECRET değerini yapıştırın. Gerçek secret'ı asla git'e commit etmeyin.
select vault.create_secret('BURAYA_GERCEK_SECRET_DEGERINI_YAZIN', 'rag_queue_worker_secret');

select cron.schedule(
  'rag-queue-worker',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'ai-question-draft-worker',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
