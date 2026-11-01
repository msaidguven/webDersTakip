-- Admin anasayfası "Slayt ve sesli anlatım kullanımı" (2026-11-01): etkileşimli ders bütün konulara yayılınca
-- slayt ve sesli anlatım gerekli mi kararı veriyle verilsin diye kim, ne kadar açıyor ve sonuna kadar kullanıyor.
--   kind: slides_open | slides_finish (son slayttan sonraki kapanış ekranına gelindi)
--         narration_play | narration_finish (son ekranın sesi bitti)
--   role: olay anındaki rol (guest = giriş yapmamış). Aynı kişi aynı konuyu bir tarayıcı oturumunda bir kez sayılır
--   (istemci tekilleştirir). Admin ve test hesapları (profiles.is_test_account) sayılmaz.
-- Yazma yalnız /api/usage-event route'undan (service role); istemci okuyamaz/yazamaz (RLS açık, policy yok).
create table if not exists public.content_view_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('guest', 'student', 'teacher', 'admin')),
  kind text not null check (kind in ('slides_open', 'slides_finish', 'narration_play', 'narration_finish')),
  topic_id bigint not null references public.topics(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists content_view_events_kind_created_idx on public.content_view_events (kind, created_at desc);
create index if not exists content_view_events_topic_idx on public.content_view_events (topic_id);
alter table public.content_view_events enable row level security;
revoke all on public.content_view_events from anon, authenticated;

-- Tek çağrıda: summary[dönem][tür] = {events, teachers, students, guests} (öğretmen/öğrenci = farklı kişi,
-- guests = misafir olay sayısı) + en çok kullanılan konular (tüm zamanlar).
create or replace function public.admin_content_usage_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ok as (
    select e.* from public.content_view_events e
    left join public.profiles p on p.id = e.user_id
    where e.role <> 'admin' and (e.user_id is null or not coalesce(p.is_test_account, false))
  ),
  windows(k, since) as (
    values
      ('today', date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
      ('d7', now() - interval '7 days'),
      ('d30', now() - interval '30 days'),
      ('all', '-infinity'::timestamptz)
  ),
  kinds(kind) as (values ('slides_open'), ('slides_finish'), ('narration_play'), ('narration_finish')),
  per_kind as (
    select w.k, kd.kind,
      count(ok.id) as events,
      count(distinct ok.user_id) filter (where ok.role = 'teacher') as teachers,
      count(distinct ok.user_id) filter (where ok.role = 'student') as students,
      count(ok.id) filter (where ok.role = 'guest') as guests
    from windows w
    cross join kinds kd
    left join ok on ok.kind = kd.kind and ok.created_at >= w.since
    group by w.k, kd.kind
  ),
  per_window as (
    select k, jsonb_object_agg(kind, jsonb_build_object('events', events, 'teachers', teachers, 'students', students, 'guests', guests)) as kinds
    from per_kind group by k
  ),
  top_topics as (
    select t.id as topic_id, t.title, g.name as grade, l.name as lesson,
      count(*) filter (where ok.kind = 'slides_open') as slides,
      count(*) filter (where ok.kind = 'narration_play') as narration
    from ok
    join public.topics t on t.id = ok.topic_id
    join public.units u on u.id = t.unit_id
    join public.grades g on g.id = u.grade_id
    join public.lessons l on l.id = u.lesson_id
    where ok.kind in ('slides_open', 'narration_play')
    group by t.id, t.title, g.name, l.name
    order by count(*) desc, t.id
    limit 8
  )
  select jsonb_build_object(
    'summary', (select jsonb_object_agg(k, kinds) from per_window),
    'topics', coalesce((select jsonb_agg(to_jsonb(x) order by x.slides + x.narration desc, x.topic_id) from top_topics x), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_content_usage_stats() from public, anon, authenticated;
grant execute on function public.admin_content_usage_stats() to service_role;
