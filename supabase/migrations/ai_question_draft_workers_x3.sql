-- Soru taslağı üretimi 1 → 3 worker (kullanıcının 2026-09-28 isteği): sorusu eksik ~320 alt
-- başlık varken saatte tek soru worker'ı (üstelik ~%50'si 503/429 ile boşa gidiyordu)
-- yetişemiyordu. Yeni worker eklemek yerine görevi biten/fazla olan iki worker'ın görevi
-- değiştiriliyor — saatlik toplam çağrı sayısı (Vercel CPU bütçesi) aynı kalıyor:
--   :13  ai-content-draft-worker-2   → PASİF; yerine ai-question-draft-worker-2 (:13)
--   :23  ai-content-draft-worker     → değişmedi (tek içerik worker'ı)
--   :37  ai-question-draft-worker    → değişmedi (worker: primary)
--   :51  ai-topic-highlights-worker  → PASİF (kuyruk 2026-09-28'de bitti, kavramlar artık
--                                      içerik üretiminde); yerine ai-question-draft-worker-3 (:51)
-- Key/model eşlemesi: app/src/lib/questionWorkerProfiles.ts. Pasife alınan job'lar SİLİNMİYOR,
-- geri açmak için: select cron.alter_job(job_id := (select jobid from cron.job where jobname = '<ad>'), active := true);
--
-- Önce kodu deploy edin (route body'deki "worker" alanını tanımalı), sonra bu dosyayı
-- Supabase SQL Editor'de bir kez çalıştırın.

alter table public.ai_question_draft_worker_runs
  add column if not exists worker text not null default 'primary'
  check (worker in ('primary', 'secondary', 'tertiary'));

-- Worker'lar farklı dakikalarda çalışıyor ama bir çalıştırma 503 yedekleriyle birkaç dakika
-- sürebiliyor; iki worker aynı alt başlığı seçerse ikincinin insert'ü burada düşer
-- (aiQuestionDraftGen.ts 23505'i "çakışma" olarak loglar), çift taslak oluşmaz.
create unique index if not exists uq_ai_question_drafts_one_pending_per_section
  on public.ai_question_drafts(section_id)
  where status = 'pending';

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-content-draft-worker-2'),
  active := false
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-topic-highlights-worker'),
  active := false
);

select cron.schedule(
  'ai-question-draft-worker-2',
  '13 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{"worker":"secondary"}'::jsonb,
    timeout_milliseconds := 360000
  );
  $$
);

select cron.schedule(
  'ai-question-draft-worker-3',
  '51 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{"worker":"tertiary"}'::jsonb,
    timeout_milliseconds := 360000
  );
  $$
);
