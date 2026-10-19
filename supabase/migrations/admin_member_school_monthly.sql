-- Admin "Üye Aktivitesi" detayı, 2026-10-18 ikinci tur:
--  1) admin_member_detail: okul adı artık schools tablosundan (school_id), yoksa serbest metin okul adından.
--  2) admin_member_monthly_activity: seçilen üyenin seçilen ayda gün × ders soru/doğru verisi
--     (ders takip çizelgesinin admin karşılığı; get_my_monthly_subject_activity ile aynı mantık, p_user_id ile).
-- Yalnızca service_role çağırır; API route'ları requireAdmin() ile yetkilendirir. Admin hesaplar dönmez.
-- Gün ve ay sınırı Europe/Istanbul.

-- 1) Detay (önceki sürümle aynı; yalnızca okul adı çözümü değişti).
create or replace function public.admin_member_detail(p_user_id uuid, p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      greatest(1, least(coalesce(p_days, 7), 90)) as days,
      now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90))) as since
  ),
  prof as (
    select
      p.full_name, p.username,
      coalesce(s.name, p.school_name) as school_name,
      p.branch, p.daily_goal, p.onboarding_completed,
      p.last_seen_at, g.name as grade_name, u.created_at as registered_at
    from public.profiles p
    left join public.grades g on g.id = p.grade_id
    left join public.schools s on s.id = p.school_id
    left join auth.users u on u.id = p.id
    where p.id = p_user_id
      and p.role is distinct from 'admin'
  ),
  answers as (
    select
      a.created_at, a.is_correct,
      l.id as lesson_id, l.name as lesson_name, l.order_no as lesson_order
    from public.test_session_answers a
    join public.questions q on q.id = a.question_id
    join public.topics t on t.id = q.topic_id
    join public.units u on u.id = t.unit_id
    join public.lessons l on l.id = u.lesson_id
    where a.user_id = p_user_id
  ),
  period_answers as (
    select an.* from answers an, params
    where an.created_at >= params.since
  ),
  period_views as (
    select v.created_at, v.path
    from public.user_page_views v, params
    where v.user_id = p_user_id
      and v.created_at >= params.since
  ),
  active_days as (
    select (created_at at time zone 'Europe/Istanbul')::date as day from period_answers
    union
    select (created_at at time zone 'Europe/Istanbul')::date from period_views
  ),
  totals as (
    select
      count(*) as answered,
      count(*) filter (where is_correct) as correct,
      count(*) filter (
        where created_at < (select registered_at from prof) + interval '7 days'
      ) as first_week_answered
    from answers
  )
  select case when not exists (select 1 from prof) then null else jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'full_name', full_name,
        'username', username,
        'grade_name', grade_name,
        'school_name', school_name,
        'branch', branch,
        'daily_goal', daily_goal,
        'onboarding_completed', onboarding_completed,
        'registered_at', registered_at,
        'last_seen_at', last_seen_at,
        'checklist', jsonb_build_array(
          jsonb_build_object('label', 'Ad soyad', 'done', coalesce(btrim(full_name), '') <> ''),
          jsonb_build_object('label', 'Kullanıcı adı', 'done', coalesce(username, '') <> ''),
          jsonb_build_object('label', 'Sınıf', 'done', grade_name is not null),
          jsonb_build_object('label', 'Okul', 'done', coalesce(btrim(school_name), '') <> ''),
          jsonb_build_object('label', 'Profil tamamlandı', 'done', onboarding_completed)
        )
      )
      from prof
    ),
    'period', jsonb_build_object(
      'days', (select days from params),
      'active_days', (select count(*) from active_days),
      'answered', (select count(*) from period_answers),
      'correct', (select count(*) filter (where is_correct) from period_answers),
      'views', (select count(*) from period_views),
      'pages', (select count(distinct path) from period_views)
    ),
    'totals', (
      select jsonb_build_object(
        'answered', answered,
        'correct', correct,
        'first_week_answered', first_week_answered,
        'reached_10_first_week', first_week_answered >= 10
      )
      from totals
    )
  ) end;
$$;

-- 2) Aylık gün × ders satırları. Ders adı da döner ki istemci sütun başlığını ayrıca sorgulamasın.
create or replace function public.admin_member_monthly_activity(p_user_id uuid, p_month date)
returns table (
  day date,
  lesson_id bigint,
  lesson_name text,
  lesson_order integer,
  answered integer,
  correct integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      (date_trunc('month', p_month)::timestamp at time zone 'Europe/Istanbul') as v_start,
      ((date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Europe/Istanbul') as v_end
  )
  select
    (a.created_at at time zone 'Europe/Istanbul')::date as day,
    l.id::bigint as lesson_id,
    l.name as lesson_name,
    l.order_no::integer as lesson_order,
    count(*)::integer as answered,
    (count(*) filter (where a.is_correct))::integer as correct
  from public.test_session_answers a
  join public.questions q on q.id = a.question_id
  join public.topics t on t.id = q.topic_id
  join public.units u on u.id = t.unit_id
  join public.lessons l on l.id = u.lesson_id
  cross join bounds b
  where a.user_id = p_user_id
    and a.created_at >= b.v_start
    and a.created_at < b.v_end
    and not exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin')
  group by 1, 2, 3, 4
  order by 1, 4;
$$;

revoke all on function public.admin_member_detail(uuid, int) from public, anon, authenticated;
revoke all on function public.admin_member_monthly_activity(uuid, date) from public, anon, authenticated;
grant execute on function public.admin_member_detail(uuid, int) to service_role;
grant execute on function public.admin_member_monthly_activity(uuid, date) to service_role;
