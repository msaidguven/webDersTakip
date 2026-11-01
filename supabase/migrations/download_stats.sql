-- Admin anasayfası "İndirmeler" (2026-10-29): ders notu PDF'i ve öğretmenin "konudan soru seç" Word dışa aktarması
-- kaç kez indirilmiş. Yazılı kâğıdı indirmeleri (PDF/cevap anahtarı/Word) zaten teacher_paper_events'te (download).
--   file_download_events.kind: topic_pdf (cached: PDF önbellekten mi geldi, değilse Chrome açıldı = CPU) | question_export
-- Üç indirme de giriş gerektirir (user_id dolu). Admin ve test hesapları (profiles.is_test_account) sayılmaz.
-- Yazma yalnız sunucu route'larından (service role); istemci okuyamaz/yazamaz (RLS açık, policy yok).
create table if not exists public.file_download_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('topic_pdf', 'question_export')),
  topic_id bigint references public.topics(id) on delete cascade,
  cached boolean,
  created_at timestamptz not null default now()
);
create index if not exists file_download_events_kind_created_idx on public.file_download_events (kind, created_at desc);
create index if not exists file_download_events_topic_idx on public.file_download_events (topic_id) where topic_id is not null;
alter table public.file_download_events enable row level security;
revoke all on public.file_download_events from anon, authenticated;

-- Tek çağrıda: summary[dönem][tür] = {downloads, users, cached} + en çok indirilen konular/yazılılar (tüm zamanlar).
create or replace function public.admin_download_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ev as (
    select 'topic_pdf'::text as kind, e.user_id, e.created_at, e.cached from public.file_download_events e where e.kind = 'topic_pdf'
    union all
    select 'question_export', e.user_id, e.created_at, null from public.file_download_events e where e.kind = 'question_export'
    union all
    select 'paper_download', t.teacher_id, t.created_at, null from public.teacher_paper_events t where t.kind = 'download'
  ),
  ok as (
    select ev.* from ev
    join public.profiles p on p.id = ev.user_id
    where p.role is distinct from 'admin' and not p.is_test_account
  ),
  windows(k, since) as (
    values
      ('today', date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
      ('d7', now() - interval '7 days'),
      ('d30', now() - interval '30 days'),
      ('all', '-infinity'::timestamptz)
  ),
  kinds(kind) as (values ('topic_pdf'), ('paper_download'), ('question_export')),
  per_kind as (
    select w.k, kd.kind,
      count(ok.user_id) as downloads,
      count(distinct ok.user_id) as users,
      count(ok.user_id) filter (where ok.cached) as cached
    from windows w
    cross join kinds kd
    left join ok on ok.kind = kd.kind and ok.created_at >= w.since
    group by w.k, kd.kind
  ),
  per_window as (
    select k, jsonb_object_agg(kind, jsonb_build_object('downloads', downloads, 'users', users, 'cached', cached)) as kinds
    from per_kind group by k
  ),
  top_topics as (
    select t.id as topic_id, t.title, g.name as grade, l.name as lesson, count(*) as downloads, count(distinct e.user_id) as users
    from public.file_download_events e
    join public.profiles p on p.id = e.user_id and p.role is distinct from 'admin' and not p.is_test_account
    join public.topics t on t.id = e.topic_id
    join public.units u on u.id = t.unit_id
    join public.grades g on g.id = u.grade_id
    join public.lessons l on l.id = u.lesson_id
    where e.kind = 'topic_pdf'
    group by t.id, t.title, g.name, l.name
    order by downloads desc, t.id
    limit 8
  ),
  top_exams as (
    select x.id as exam_id, g.name as grade, l.name as lesson, x.term, x.exam_no, count(*) as downloads, count(distinct t.teacher_id) as users
    from public.teacher_paper_events t
    join public.profiles p on p.id = t.teacher_id and p.role is distinct from 'admin' and not p.is_test_account
    join public.exams x on x.id = t.exam_id
    join public.grades g on g.id = x.grade_id
    join public.lessons l on l.id = x.lesson_id
    where t.kind = 'download'
    group by x.id, g.name, l.name, x.term, x.exam_no
    order by downloads desc, x.id
    limit 8
  )
  select jsonb_build_object(
    'summary', (select jsonb_object_agg(k, kinds) from per_window),
    'topics', coalesce((select jsonb_agg(to_jsonb(x) order by x.downloads desc, x.topic_id) from top_topics x), '[]'::jsonb),
    'exams', coalesce((select jsonb_agg(to_jsonb(x) order by x.downloads desc, x.exam_id) from top_exams x), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_download_stats() from public, anon, authenticated;
grant execute on function public.admin_download_stats() to service_role;
