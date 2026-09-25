-- Kullanıcının 2026-09-25 raporu: tüm worker'lar saat başına yakın dakikalarda (:00/:04/:05)
-- çalışıyor, tam bu saatlerde Gemini sürekli 503 ("high demand"/yoğunluk) döndürüyor —
-- muhtemelen herkesin cron'u saat başına yakın ateşlendiği için model o dakikalarda tıkanık.
-- Çözüm: worker'ları farklı dakikalara yay + saatte bire indir (içerik zaten yeterince
-- durağan bir üretim, 20 dakikada bir denemenin faydası yoktu). Ayrıca öğrenci soru-cevap
-- ("hoca/kanka" modu, rag-queue-worker → process-queue) kullanıcının isteğiyle ŞİMDİLİK
-- pasif; onun yerine aynı saatlik ritimde konu kapaklarında eksik olan "Anahtar Kavramlar"ı
-- otomatik tamamlayan yeni bir worker ekleniyor.
--
-- Yeni ritim: içerik :23, sorular :37, anahtar kavramlar :51 — üçü de saatte bir.
-- rag-queue-worker (hoca/kanka) aktif=false yapılıyor (job tanımı SİLİNMİYOR, istenirse
-- `select cron.alter_job(job_id := (select jobid from cron.job where jobname =
-- 'rag-queue-worker'), active := true);` ile geri açılabilir).
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'rag-queue-worker'),
  active := false
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-content-draft-worker'),
  schedule := '23 * * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-question-draft-worker'),
  schedule := '37 * * * *'
);

-- Konu içeriği (topic_contents) yayında ama henüz "Anahtar Kavramlar" (topic_content_highlights)
-- hiç üretilmemiş bir sonraki konuyu seçer — find_next_ai_content_draft_topic ile AYNI
-- sıralama deseni (sınıf/ders/ünite/konu order_no).
create or replace function public.find_next_topic_missing_highlights()
returns table (
  topic_id bigint,
  topic_content_id bigint,
  unit_id bigint,
  lesson_id bigint,
  grade_id bigint
)
language sql stable security definer set search_path = public
as $$
  select t.id as topic_id, tc.id as topic_content_id, u.id as unit_id, u.lesson_id, u.grade_id
  from public.topics t
  join public.units u on u.id = t.unit_id and u.is_active = true
  join public.lessons l on l.id = u.lesson_id and l.is_active = true
  join public.grades g on g.id = u.grade_id and g.is_active = true
  join public.topic_contents tc on tc.topic_id = t.id and tc.is_published = true
  where t.is_active = true
    and not exists (select 1 from public.topic_content_highlights h where h.topic_content_id = tc.id)
  order by g.order_no, l.order_no, u.order_no, t.order_no
  limit 1;
$$;

create table if not exists public.ai_topic_highlights_worker_runs (
  id bigint generated always as identity primary key,
  generated boolean not null,
  reason text,
  topic_id bigint references public.topics(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_topic_highlights_worker_runs_created on public.ai_topic_highlights_worker_runs(created_at desc);

alter table public.ai_topic_highlights_worker_runs enable row level security;
-- ai_content_draft_worker_runs ile aynı desen: client-erişim policy'si yok, sadece
-- service role (worker route'u) yazar.

select cron.schedule(
  'ai-topic-highlights-worker',
  '51 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-topic-highlights',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
