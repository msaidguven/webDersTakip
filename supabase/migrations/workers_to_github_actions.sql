-- AI worker'ları (soru x3 + etkileşimli ders eki, içerik, sesli anlatım) Vercel yerine GitHub Actions'ta
-- çalışsın (2026-11-15): Vercel Hobby'nin aylık 4 saatlik aktif CPU sınırının tahminen yarısını bu
-- zamanlanmış işler yiyordu. Zamanlama yine burada, pg_cron'da kalır; yalnız HEDEF değişir:
-- Vercel rotası yerine .github/workflows/worker.yml (workflow_dispatch). Worker'ın yaptığı iş aynıdır
-- (app/src/lib/workerRuns.ts), çalışma kayıtları aynı *_worker_runs tablolarına düşer.
--
-- ÇALIŞTIRMADAN ÖNCE (sıra önemli):
--   1) worker.yml master dalında olmalı (push edilmiş).
--   2) Yalnız bu depoya, "Actions: Read and write" yetkili bir GitHub fine-grained token'ı Vault'a eklenmeli:
--        select vault.create_secret('<TOKEN>', 'github_actions_dispatch_token', 'pg_cron -> GitHub Actions worker tetikleyicisi');
--      (Gerçek token bu dosyaya YAZILMAZ. Yenilemek için: vault.update_secret.)
-- Geri dönüş: supabase/manual/workers_back_to_vercel.sql

create or replace function public.dispatch_github_worker(p_kind text, p_worker text default '', p_task text default '')
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'github_actions_dispatch_token';
  if v_token is null then
    raise exception 'Vault''ta github_actions_dispatch_token yok — worker tetiklenemedi';
  end if;
  return net.http_post(
    url := 'https://api.github.com/repos/msaidguven/webDersTakip/actions/workflows/worker.yml/dispatches',
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'X-GitHub-Api-Version', '2022-11-28',
      'Authorization', 'Bearer ' || v_token
    ),
    body := jsonb_build_object('ref', 'master', 'inputs', jsonb_build_object('kind', p_kind, 'worker', p_worker, 'task', p_task)),
    timeout_milliseconds := 15000
  );
end;
$$;

-- Yalnız pg_cron (postgres) çağırır; istemci rolleri tetikleyemesin.
revoke all on function public.dispatch_github_worker(text, text, text) from public, anon, authenticated;

-- cron.schedule aynı adla çağrılınca var olan işin zamanını ve komutunu değiştirir. Zamanlar canlıdakiyle aynı.
select cron.schedule('ai-question-draft-worker', '37 * * * *', $$select public.dispatch_github_worker('question')$$);
select cron.schedule('ai-question-draft-worker-2', '13 * * * *', $$select public.dispatch_github_worker('question', 'secondary')$$);
select cron.schedule('ai-question-draft-worker-3', '51 * * * *', $$select public.dispatch_github_worker('question', 'tertiary')$$);
select cron.schedule('interactive-lesson-worker-extra', '33,53 * * * *', $$select public.dispatch_github_worker('question', 'secondary', 'interactive_lesson')$$);
select cron.schedule('ai-content-draft-worker', '23 * * * *', $$select public.dispatch_github_worker('content')$$);
select cron.schedule('topic-narration-worker', '45 * * * *', $$select public.dispatch_github_worker('narration')$$);
