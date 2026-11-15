-- Etkileşimli ders (kullanıcı kararları 2026-11-03):
-- 1) Ders öğrenciye ancak Bit sesleri tamamlanınca görünür (konu sayfası düğmesi bu fonksiyona bakar).
-- 2) Kullanım ölçümü: content_view_events'e interactive_open (Başla) / interactive_finish (ders sonu).
-- 3) Üyeler için kaldığı yerden devam: adım + adım durumları (istemci RLS ile kendi satırını okur/yazar —
--    Vercel'e uğramaz). Ders yeniden üretilip adım sayısı değişirse istemci kaydı yok sayar.
-- 4) Admin anasayfası "Etkileşimli dersler" raporu: üretim durumu + kullanım (admin_interactive_lesson_stats).

-- 1) Sesleri tamamlanmış hazır dersler
create or replace function public.interactive_lesson_ready_topics(p_topic_ids bigint[])
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select l.topic_id from public.interactive_lessons l
  where l.status = 'ready' and l.voice_done and l.topic_id = any (p_topic_ids);
$$;
revoke all on function public.interactive_lesson_ready_topics(bigint[]) from public;
grant execute on function public.interactive_lesson_ready_topics(bigint[]) to anon, authenticated, service_role;

-- 2) Kullanım olayları
alter table public.content_view_events drop constraint if exists content_view_events_kind_check;
alter table public.content_view_events add constraint content_view_events_kind_check
  check (kind in ('slides_open', 'slides_finish', 'narration_play', 'narration_finish', 'interactive_open', 'interactive_finish'));

-- 3) Kaldığı yerden devam
create table if not exists public.interactive_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id bigint not null references public.topics(id) on delete cascade,
  step_index integer not null default 0 check (step_index >= 0),
  step_count integer not null check (step_count > 0),
  -- { states, retryStates, seed } — oynatıcının adım durumları
  state jsonb not null default '{}'::jsonb check (pg_column_size(state) < 300000),
  finished boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
alter table public.interactive_lesson_progress enable row level security;
revoke all on public.interactive_lesson_progress from anon;
grant select, insert, update, delete on public.interactive_lesson_progress to authenticated;
drop policy if exists "own progress select" on public.interactive_lesson_progress;
drop policy if exists "own progress insert" on public.interactive_lesson_progress;
drop policy if exists "own progress update" on public.interactive_lesson_progress;
drop policy if exists "own progress delete" on public.interactive_lesson_progress;
create policy "own progress select" on public.interactive_lesson_progress for select to authenticated using (auth.uid() = user_id);
create policy "own progress insert" on public.interactive_lesson_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "own progress update" on public.interactive_lesson_progress for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own progress delete" on public.interactive_lesson_progress for delete to authenticated using (auth.uid() = user_id);

-- 4) Admin raporu (tek çağrı). Admin ve test hesapları kullanımda sayılmaz.
create or replace function public.admin_interactive_lesson_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ok as (
    select e.* from public.content_view_events e
    left join public.profiles p on p.id = e.user_id
    where e.kind in ('interactive_open', 'interactive_finish')
      and e.role <> 'admin' and (e.user_id is null or not coalesce(p.is_test_account, false))
  ),
  windows(k, since) as (
    values
      ('today', date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul'),
      ('d7', now() - interval '7 days'),
      ('d30', now() - interval '30 days'),
      ('all', '-infinity'::timestamptz)
  ),
  usage as (
    select w.k,
      count(ok.id) filter (where ok.kind = 'interactive_open') as opens,
      count(ok.id) filter (where ok.kind = 'interactive_finish') as finishes,
      count(distinct ok.user_id) filter (where ok.kind = 'interactive_open' and ok.role = 'student') as students,
      count(distinct ok.user_id) filter (where ok.kind = 'interactive_open' and ok.role = 'teacher') as teachers,
      count(ok.id) filter (where ok.kind = 'interactive_open' and ok.role = 'guest') as guests
    from windows w left join ok on ok.created_at >= w.since
    group by w.k
  ),
  -- Worker'ın üretebileceği konular (claim_next_interactive_lesson_topic ile aynı ölçüt)
  eligible as (
    select c.topic_id from public.topic_contents c
    where c.is_published and (
      select count(*) from public.questions q
      join public.topic_content_sections s on s.id = q.section_id
      join public.topic_contents c2 on c2.id = s.topic_content_id
      where c2.topic_id = c.topic_id and c2.is_published and q.is_active and q.question_type_id in (1, 3)
    ) >= 4
    group by c.topic_id
  ),
  runs as (
    select r.created_at, r.generated, r.reason from public.ai_question_draft_worker_runs r
    where r.worker = 'secondary' and r.created_at > now() - interval '7 days' and r.reason like 'Etkileşimli ders%'
  )
  select jsonb_build_object(
    'status', jsonb_build_object(
      'visible', (select count(*) from public.interactive_lessons where status = 'ready' and voice_done),
      'awaiting_voice', (select count(*) from public.interactive_lessons where status = 'ready' and not voice_done),
      'in_progress', (select count(*) from public.interactive_lessons where status in ('partial', 'generating') or (status = 'failed' and runs < 3)),
      'given_up', (select count(*) from public.interactive_lessons where status = 'failed' and runs >= 3),
      'queued', (select count(*) from eligible e where not exists (select 1 from public.interactive_lessons l where l.topic_id = e.topic_id))
    ),
    'last7', jsonb_build_object(
      'sections', (select count(*) from runs where generated and reason not like '%Bit sesi%'),
      'lessons_done', (select count(*) from public.interactive_lessons where status = 'ready' and updated_at > now() - interval '7 days'),
      'quota_skips', (select count(*) from public.ai_question_draft_worker_runs r where r.worker = 'secondary' and r.created_at > now() - interval '7 days' and r.reason like '%kotası dolu%')
    ),
    'usage', (select jsonb_object_agg(k, jsonb_build_object('opens', opens, 'finishes', finishes, 'students', students, 'teachers', teachers, 'guests', guests)) from usage),
    'recent', coalesce((
      select jsonb_agg(x order by x.updated_at desc) from (
        select l.topic_id, t.title, g.name as grade, le.name as lesson, l.status, l.voice_done, l.updated_at
        from public.interactive_lessons l
        join public.topics t on t.id = l.topic_id
        join public.units u on u.id = t.unit_id
        join public.grades g on g.id = u.grade_id
        join public.lessons le on le.id = u.lesson_id
        order by l.updated_at desc
        limit 8
      ) x
    ), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(x order by x.opens desc) from (
        select t.id as topic_id, t.title, g.name as grade, le.name as lesson,
          count(*) filter (where ok.kind = 'interactive_open') as opens,
          count(*) filter (where ok.kind = 'interactive_finish') as finishes
        from ok
        join public.topics t on t.id = ok.topic_id
        join public.units u on u.id = t.unit_id
        join public.grades g on g.id = u.grade_id
        join public.lessons le on le.id = u.lesson_id
        group by t.id, t.title, g.name, le.name
        order by opens desc
        limit 8
      ) x
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.admin_interactive_lesson_stats() from public, anon, authenticated;
grant execute on function public.admin_interactive_lesson_stats() to service_role;
