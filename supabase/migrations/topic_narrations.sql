-- "Video / Sesli Anlatım" tüm konulara (2026-10-02). Prototip (konu 567) sabit bir pilot listesiyle
-- açılıyordu; artık hangi konunun anlatımı hazır olduğu burada tutuluyor ve sesler saatlik bir
-- worker'la (app/api/narration/worker) sırayla üretiliyor. Ses/manifest dosyaları DB'de değil,
-- Storage'daki public `topic-narration` bucket'ında (bkz. app/src/lib/narration/).
--
-- ÖNCE kodu deploy edin ve Vercel'e AZURE_SPEECH_KEY / AZURE_SPEECH_REGION ekleyin, SONRA bu
-- dosyayı Supabase SQL Editor'de bir kez çalıştırın (sondaki cron.schedule worker'ı başlatır).

-- Satır = o konunun anlatımı yayında. source_hash, anlatımın üretildiği alt başlık metinlerinin
-- özeti: içerik değişince farklılaşır, worker konuyu yeniden seslendirir (değişmeyen cümleler
-- Storage önbelleğinden gelir). Yeniden üretim bitene kadar eski anlatım oynamaya devam eder.
create table if not exists public.topic_narrations (
  topic_id bigint primary key references public.topics(id) on delete cascade,
  source_hash text not null,
  voice text not null,
  screen_count integer not null,
  duration_seconds numeric(8, 2) not null,
  generated_at timestamptz not null default now()
);

alter table public.topic_narrations enable row level security;
-- Herkese açık içerik bilgisi (konu sayfası butonu) — okuma serbest, yazma sadece service role.
drop policy if exists topic_narrations_public_read on public.topic_narrations;
create policy topic_narrations_public_read on public.topic_narrations for select to anon, authenticated using (true);
grant select on public.topic_narrations to anon, authenticated;

-- net.http_post yanıtı beklemediği için her çalıştırma loglanır (ai_question_draft_worker_runs
-- ile aynı gerekçe). outcome: completed (konu bitti) | partial (süre doldu, sonraki çalıştırma
-- devam eder) | failed (hata; aynı konu 24 saatte 3 kez düşerse kuyrukta atlanır) | idle (iş yok).
create table if not exists public.topic_narration_worker_runs (
  id bigint generated always as identity primary key,
  topic_id bigint references public.topics(id) on delete set null,
  outcome text not null check (outcome in ('completed', 'partial', 'failed', 'idle')),
  screens_made integer not null default 0,
  screens_reused integer not null default 0,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_topic_narration_worker_runs_created on public.topic_narration_worker_runs(created_at desc);
create index if not exists idx_topic_narration_worker_runs_topic on public.topic_narration_worker_runs(topic_id, created_at desc);
alter table public.topic_narration_worker_runs enable row level security;
-- Kasıtlı olarak policy yok: sadece service role yazar/okur.

-- Anlatımın kaynağı olan metnin özeti — worker da üretici betik de bunu kullanır (tek tanım).
create or replace function public.topic_narration_source_hash(p_topic_id bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select md5(string_agg(s.id::text || chr(31) || s.heading || chr(31) || coalesce(s.body_markdown, ''), chr(30) order by s.order_no, s.id))
  from public.topic_contents tc
  join public.topic_content_sections s on s.topic_content_id = tc.id
  where tc.topic_id = p_topic_id;
$$;

-- Sıradaki seslendirilecek konu: yayında, aktif, arşivlenmemiş, alt başlığı olan ve anlatımı hiç
-- olmayan (önce) ya da içeriği değişmiş (sonra) konu. Son 24 saatte 3 kez hata veren konu atlanır
-- ki tek bozuk konu kuyruğu kilitlemesin.
create or replace function public.next_topic_for_narration()
returns table (topic_id bigint, source_hash text)
language sql
stable
security definer
set search_path = public
as $$
  with src as (
    select t.id as topic_id, public.topic_narration_source_hash(t.id) as source_hash
    from public.topics t
    where t.is_active
      and not t.is_archived
      and exists (
        select 1 from public.topic_contents tc
        join public.topic_content_sections s on s.topic_content_id = tc.id
        where tc.topic_id = t.id and tc.is_published
      )
  )
  select src.topic_id, src.source_hash
  from src
  left join public.topic_narrations n on n.topic_id = src.topic_id
  where (n.topic_id is null or n.source_hash <> src.source_hash)
    and (
      select count(*) from public.topic_narration_worker_runs r
      where r.topic_id = src.topic_id and r.outcome = 'failed' and r.created_at > now() - interval '24 hours'
    ) < 3
  order by (n.topic_id is not null), src.topic_id
  limit 1;
$$;

revoke all on function public.topic_narration_source_hash(bigint) from public, anon, authenticated;
revoke all on function public.next_topic_for_narration() from public, anon, authenticated;
grant execute on function public.topic_narration_source_hash(bigint) to service_role;
grant execute on function public.next_topic_for_narration() to service_role;

-- Saatte bir (:45 — diğer worker'lar :00/:13/:23/:37/:51'de). Bir çalıştırma ~4 dk sürer; çoğu
-- TTS yanıtı beklemek (Vercel aktif CPU'ya sayılmaz), MP3 doğrudan Azure'dan geldiği için kodlama yok.
select cron.schedule(
  'topic-narration-worker',
  '45 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/narration/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 360000
  );
  $$
);
