-- İkinci içerik worker'ı (kullanıcının 2026-09-25 isteği): mevcut ai-content-draft-worker ile
-- AYNI route, AYNI prompt ve AYNI konu seçim RPC'si (find_next_ai_content_draft_topic), ama
-- ayrı bir API key (NEW_GEMINI_API_KEY_CONTENT) ve ayrı model (gemini-3.8-flash) ile —
-- bkz. app/src/lib/contentWorkerProfiles.ts. Amaç: iki ayrı free-tier kotası ile saatte
-- iki konu üretmek.
--
-- Zamanlama: her saat :13'te (kullanıcının isteği), mevcut worker :23'te. Bir çalıştırma
-- 503 tekrarıyla ~10 dk sürebildiği için ikisi nadiren aynı konuyu seçebilir; bu durumda
-- aiContentDraftGen.ts kaydetmeden önce konunun hâlâ boş olduğunu tekrar kontrol ediyor ve
-- geç kalan worker yayınlamadan çıkıyor (üzerine yazma yok).
--
-- ÖNCE Vercel'e NEW_GEMINI_API_KEY_CONTENT ekleyip redeploy edin, sonra bu dosyayı Supabase
-- SQL Editor'de bir kez çalıştırın. Durdurmak için:
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'ai-content-draft-worker-2'), active := false);

alter table public.ai_content_draft_worker_runs
  add column if not exists worker text not null default 'primary'
  check (worker in ('primary', 'secondary'));

select cron.schedule(
  'ai-content-draft-worker-2',
  '13 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-topic-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{"worker":"secondary"}'::jsonb,
    timeout_milliseconds := 360000
  );
  $$
);
