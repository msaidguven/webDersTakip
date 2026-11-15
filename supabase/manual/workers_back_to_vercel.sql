-- Geri dönüş: worker'ları GitHub Actions'tan tekrar Vercel rotalarına bağlar (workers_to_github_actions.sql'in
-- tersi; 2026-11-15'teki canlı komutların birebir kopyası). Rotalar Vercel'de durduğu için başka adım gerekmez.

select cron.schedule('ai-question-draft-worker', '37 * * * *', $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 360000
  );
$$);

select cron.schedule('ai-question-draft-worker-2', '13 * * * *', $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{"worker":"secondary"}'::jsonb,
    timeout_milliseconds := 360000
  );
$$);

select cron.schedule('ai-question-draft-worker-3', '51 * * * *', $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{"worker":"tertiary"}'::jsonb,
    timeout_milliseconds := 360000
  );
$$);

select cron.schedule('interactive-lesson-worker-extra', '33,53 * * * *', $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{"worker":"secondary","task":"interactive_lesson"}'::jsonb,
    timeout_milliseconds := 360000
  );
$$);

select cron.schedule('ai-content-draft-worker', '23 * * * *', $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-topic-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 360000
  );
$$);

select cron.schedule('topic-narration-worker', '45 * * * *', $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/narration/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 360000
  );
$$);
