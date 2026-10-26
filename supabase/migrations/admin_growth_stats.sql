-- Admin "Site Gelişimi" paneli (2026-10-25): günlük yeni üye, siteye giren öğrenci (o gün kayıt olan /
-- geri dönen), çözülen soru ve test, geri dönüş oranı, kayıt kaynağı, sınıf dağılımı — tek çağrıda.
-- Günler Türkiye saatine göre. Admin hesapları sayılmaz; rolü boş üye öğrenci sayılır.
--
-- Veri sınırları: aktiflik user_page_views'tan (2026-09-26'dan beri, yalnız giriş yapmış üyeler);
-- kayıt kaynağı profiles.acquisition'dan (member_acquisition.sql sonrası kayıtlar). Misafir ziyareti
-- DB'de yok — tek misafir izi günün sorusu cevapları (daily_question_answers.anon_key).
--
-- Okuma yalnız admin API'si (service role) üzerinden; client çağıramaz (admin_member_activity_rpcs.sql
-- ile aynı desen).
create or replace function public.admin_growth_stats(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      greatest(7, least(coalesce(p_days, 30), 180)) as days,
      (now() at time zone 'Europe/Istanbul')::date as today
  ),
  bounds as (
    select
      days,
      today,
      today - days + 1 as start_day,
      today - 2 * days + 1 as prev_start_day,
      ((today - days + 1)::timestamp at time zone 'Europe/Istanbul') as start_ts,
      ((today - 2 * days + 1)::timestamp at time zone 'Europe/Istanbul') as prev_start_ts
    from params
  ),
  members as (
    select
      u.id,
      u.created_at,
      (u.created_at at time zone 'Europe/Istanbul')::date as signup_day,
      coalesce(p.role, 'student') as role,
      p.grade_id,
      p.signup_method,
      p.acquisition
    from auth.users u
    left join public.profiles p on p.id = u.id
    where coalesce(p.role, 'student') <> 'admin'
  ),
  students as (select * from members where role = 'student'),
  student_days as (
    select distinct v.user_id, (v.created_at at time zone 'Europe/Istanbul')::date as day
    from public.user_page_views v, bounds b
    where v.created_at >= b.prev_start_ts
      and exists (select 1 from students s where s.id = v.user_id)
  ),
  answers as (
    select (a.created_at at time zone 'Europe/Istanbul')::date as day
    from public.test_session_answers a, bounds b
    where a.created_at >= b.prev_start_ts
      and exists (select 1 from members m where m.id = a.user_id)
  ),
  sessions as (
    select
      (t.created_at at time zone 'Europe/Istanbul')::date as started_day,
      (t.completed_at at time zone 'Europe/Istanbul')::date as completed_day
    from public.test_sessions t, bounds b
    where (t.created_at >= b.start_ts or t.completed_at >= b.start_ts)
      and exists (select 1 from members m where m.id = t.user_id)
  ),
  daily_q as (
    select (d.created_at at time zone 'Europe/Istanbul')::date as day, d.user_id is null as guest
    from public.daily_question_answers d, bounds b
    where d.created_at >= b.prev_start_ts
      and (d.user_id is null or exists (select 1 from members m where m.id = d.user_id))
  ),
  days as (
    select generate_series(b.start_day, b.today, interval '1 day')::date as day from bounds b
  ),
  series as (
    select
      d.day,
      (select count(*) from students s where s.signup_day = d.day) as new_students,
      (select count(*) from members m where m.role = 'teacher' and m.signup_day = d.day) as new_teachers,
      (select count(*) from student_days sd join students s on s.id = sd.user_id
        where sd.day = d.day and s.signup_day = d.day) as active_new,
      (select count(*) from student_days sd join students s on s.id = sd.user_id
        where sd.day = d.day and s.signup_day < d.day) as active_returning,
      (select count(*) from answers a where a.day = d.day) as answers,
      (select count(*) from sessions t where t.started_day = d.day) as tests_started,
      (select count(*) from sessions t where t.completed_day = d.day) as tests_completed
    from days d
  ),
  -- Geri dönüş: dönemde kayıt olup kayıttan en az 7 gün geçmiş öğrencilerden kaçı, kayıt gününden
  -- sonraki 7 gün içinde tekrar gelmiş. Aktiflik izi 2026-09-26'da başladığı için kohort oradan başlar.
  cohort as (
    select s.id, s.signup_day
    from students s, bounds b
    where s.signup_day >= greatest(b.start_day, date '2026-09-26')
      and s.signup_day <= b.today - 7
  ),
  acq as (
    select m.*
    from members m, bounds b
    where m.created_at >= b.start_ts
  )
  select jsonb_build_object(
    'days', (select days from bounds),
    'today', (select today from bounds),
    'tracking_since', date '2026-09-26',
    'totals', jsonb_build_object(
      'members', (select count(*) from members),
      'students', (select count(*) from students),
      'teachers', (select count(*) from members where role = 'teacher'),
      'new_period', (select count(*) from members, bounds b where signup_day >= b.start_day),
      'new_prev', (select count(*) from members, bounds b where signup_day >= b.prev_start_day and signup_day < b.start_day),
      'active_today', (select count(distinct user_id) from student_days, bounds b where day = b.today),
      'active_7d', (select count(distinct user_id) from student_days, bounds b where day > b.today - 7),
      'active_7d_prev', (select count(distinct user_id) from student_days, bounds b where day > b.today - 14 and day <= b.today - 7),
      'active_period', (select count(distinct user_id) from student_days, bounds b where day >= b.start_day),
      'answers_period', (select count(*) from answers, bounds b where day >= b.start_day),
      'answers_prev', (select count(*) from answers, bounds b where day < b.start_day),
      'daily_q_period', (select count(*) from daily_q, bounds b where day >= b.start_day),
      'daily_q_guest_period', (select count(*) from daily_q, bounds b where day >= b.start_day and guest),
      'retention_cohort', (select count(*) from cohort),
      'retention_returned', (
        select count(*) from cohort c
        where exists (
          select 1 from public.user_page_views v
          where v.user_id = c.id
            and (v.created_at at time zone 'Europe/Istanbul')::date between c.signup_day + 1 and c.signup_day + 7
        )
      )
    ),
    'series', coalesce((select jsonb_agg(s order by s.day) from series s), '[]'::jsonb),
    'acquisition', jsonb_build_object(
      'with_data', (select count(*) from acq where acquisition is not null),
      'new_in_period', (select count(*) from acq),
      'sources', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc)
        from (
          select
            case
              when coalesce(acquisition->>'referrer_host', '') = '' then 'Doğrudan'
              when acquisition->>'referrer_host' ~* '(^|\.)google\.' then 'Google'
              when acquisition->>'referrer_host' ~* '(bing|yandex|duckduckgo|yahoo)\.' then 'Diğer arama motoru'
              else acquisition->>'referrer_host'
            end as label,
            count(*) as n
          from acq where acquisition is not null
          group by 1
        ) x
      ), '[]'::jsonb),
      'landing_pages', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc)
        from (
          select acquisition->>'landing_path' as label, count(*) as n
          from acq where coalesce(acquisition->>'landing_path', '') <> ''
          group by 1 order by count(*) desc limit 8
        ) x
      ), '[]'::jsonb),
      'devices', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc)
        from (
          select coalesce(acquisition->>'device_type', 'bilinmiyor') as label, count(*) as n
          from acq where acquisition is not null group by 1
        ) x
      ), '[]'::jsonb),
      'methods', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by n desc)
        from (
          select coalesce(signup_method, 'bilinmiyor') as label, count(*) as n from acq group by 1
        ) x
      ), '[]'::jsonb)
    ),
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by ord nulls last)
      from (
        select coalesce(g.name, 'Sınıf seçmemiş') as label, g.order_no as ord, count(*) as n
        from students s left join public.grades g on g.id = s.grade_id
        group by g.name, g.order_no
      ) x
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.admin_growth_stats(int) from public, anon, authenticated;
grant execute on function public.admin_growth_stats(int) to service_role;
