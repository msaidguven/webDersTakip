-- Saatlik ziyaretçi & üye trafik kovası (mobil/tablet/masaüstü, kaynak, sayfa grubu, platform modu)
-- + profiles.last_device_type + admin_growth_stats() güncellemesi.
-- Her ziyaretçi istemci tarafında saatte en fazla 1 kez ping atar; burada ham log yerine
-- saatlik sayaç toplanır (günde ~150-300 satır, şişmez, KVKK açısından kişisel veri/IP yok).

create table if not exists public.traffic_hourly_buckets (
  bucket_hour timestamptz not null,
  visitor_type text not null check (visitor_type in ('guest', 'member')),
  device_type text not null check (device_type in ('mobile', 'tablet', 'desktop')),
  app_mode text not null check (app_mode in ('browser', 'pwa', 'in_app')),
  source_group text not null check (source_group in ('google', 'other_search', 'social', 'direct', 'referral')),
  landing_group text not null check (landing_group in ('anasayfa', 'ders-konu', 'soru-bankasi', 'yazili', 'takdir-hesaplama', 'kavram-avi', 'diger')),
  hit_count integer not null default 1 check (hit_count > 0),
  primary key (bucket_hour, visitor_type, device_type, app_mode, source_group, landing_group)
);

-- RLS açık, istemciye hiçbir politika yok — okuma/yazma yalnızca service_role RPC üzerinden.
alter table public.traffic_hourly_buckets enable row level security;

-- Üyenin son kullandığı cihaz (kayıt anındaki cihazdan farklı olabilir).
alter table public.profiles
  add column if not exists last_device_type text check (last_device_type in ('mobile', 'tablet', 'desktop'));

-- Mevcut profiles_acquisition_guard fonksiyonunu last_device_type'ı da koruyacak şekilde güncelle.
create or replace function public.prevent_client_acquisition_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.signup_method is distinct from old.signup_method
       or new.acquisition is distinct from old.acquisition
       or new.last_device_type is distinct from old.last_device_type
    then
      raise exception 'Kayıt kaynağı ve cihaz bilgisi yalnızca sunucu tarafından değiştirilebilir';
    end if;
  end if;
  return new;
end;
$$;

-- Saatlik trafik ping'i kaydeder (yalnızca /api/track/visit service_role ile çağırır).
-- Admin ve test hesapları hiçbir zaman sayılmaz.
create or replace function public.record_traffic_ping(
  p_visitor_type text,
  p_device_type text,
  p_app_mode text,
  p_source_group text,
  p_landing_group text,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_skip boolean := false;
begin
  if p_user_id is not null then
    select (role = 'admin' or coalesce(is_test_account, false))
      into v_skip
      from public.profiles
     where id = p_user_id;

    if coalesce(v_skip, false) then
      return;
    end if;

    update public.profiles
       set last_device_type = p_device_type
     where id = p_user_id
       and last_device_type is distinct from p_device_type;
  end if;

  insert into public.traffic_hourly_buckets (
    bucket_hour, visitor_type, device_type, app_mode, source_group, landing_group, hit_count
  ) values (
    date_trunc('hour', now()),
    p_visitor_type,
    p_device_type,
    p_app_mode,
    p_source_group,
    p_landing_group,
    1
  )
  on conflict (bucket_hour, visitor_type, device_type, app_mode, source_group, landing_group)
  do update set hit_count = public.traffic_hourly_buckets.hit_count + 1;
end;
$$;

revoke all on function public.record_traffic_ping(text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_traffic_ping(text, text, text, text, text, uuid) to service_role;

-- Site Gelişimi RPC: mevcut tüm metrikler korunur + 'traffic' bloğu eklenir +
-- acquisition.sources Google regex'i Android GoogleQuickSearchBox'ı da Google olarak gruplar.
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
    where coalesce(p.role, 'student') <> 'admin' and not coalesce(p.is_test_account, false)
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
  ),
  traffic_period as (
    select tb.*
    from public.traffic_hourly_buckets tb, bounds b
    where tb.bucket_hour >= b.start_ts
  ),
  traffic_prev as (
    select coalesce(sum(tb.hit_count), 0)::bigint as total
    from public.traffic_hourly_buckets tb, bounds b
    where tb.bucket_hour >= b.prev_start_ts
      and tb.bucket_hour < b.start_ts
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
              when acquisition->>'referrer_host' ~* '(^|\.)google\.|googlequicksearchbox' then 'Google'
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
    ), '[]'::jsonb),
    'traffic', jsonb_build_object(
      'tracking_since', (select (min(bucket_hour) at time zone 'Europe/Istanbul')::date from public.traffic_hourly_buckets),
      'total', coalesce((select sum(hit_count)::bigint from traffic_period), 0),
      'prev_total', (select total from traffic_prev),
      'members', coalesce((select sum(hit_count)::bigint from traffic_period where visitor_type = 'member'), 0),
      'guests', coalesce((select sum(hit_count)::bigint from traffic_period where visitor_type = 'guest'), 0),
      'by_device', coalesce((
        select jsonb_agg(jsonb_build_object('label', device_type, 'count', total, 'members', members, 'guests', guests) order by total desc)
        from (
          select
            device_type,
            sum(hit_count)::bigint as total,
            coalesce(sum(hit_count) filter (where visitor_type = 'member'), 0)::bigint as members,
            coalesce(sum(hit_count) filter (where visitor_type = 'guest'), 0)::bigint as guests
          from traffic_period
          group by device_type
        ) x
      ), '[]'::jsonb),
      'by_app_mode', coalesce((
        select jsonb_agg(jsonb_build_object('label', app_mode, 'count', n) order by n desc)
        from (
          select app_mode, sum(hit_count)::bigint as n
          from traffic_period
          group by app_mode
        ) x
      ), '[]'::jsonb),
      'by_source', coalesce((
        select jsonb_agg(jsonb_build_object('label', source_group, 'count', n) order by n desc)
        from (
          select source_group, sum(hit_count)::bigint as n
          from traffic_period
          group by source_group
        ) x
      ), '[]'::jsonb),
      'by_landing', coalesce((
        select jsonb_agg(jsonb_build_object('label', landing_group, 'total', total, 'mobile', mobile, 'tablet', tablet, 'desktop', desktop) order by total desc)
        from (
          select
            landing_group,
            sum(hit_count)::bigint as total,
            coalesce(sum(hit_count) filter (where device_type = 'mobile'), 0)::bigint as mobile,
            coalesce(sum(hit_count) filter (where device_type = 'tablet'), 0)::bigint as tablet,
            coalesce(sum(hit_count) filter (where device_type = 'desktop'), 0)::bigint as desktop
          from traffic_period
          group by landing_group
        ) x
      ), '[]'::jsonb),
      'by_hour', coalesce((
        select jsonb_agg(jsonb_build_object('hour', h.hour, 'mobile', coalesce(x.mobile, 0), 'tablet', coalesce(x.tablet, 0), 'desktop', coalesce(x.desktop, 0)) order by h.hour)
        from generate_series(0, 23) as h(hour)
        left join (
          select
            extract(hour from (bucket_hour at time zone 'Europe/Istanbul'))::int as hour,
            coalesce(sum(hit_count) filter (where device_type = 'mobile'), 0)::bigint as mobile,
            coalesce(sum(hit_count) filter (where device_type = 'tablet'), 0)::bigint as tablet,
            coalesce(sum(hit_count) filter (where device_type = 'desktop'), 0)::bigint as desktop
          from traffic_period
          group by 1
        ) x on x.hour = h.hour
      ), '[]'::jsonb)
    )
  );
$$;

revoke all on function public.admin_growth_stats(int) from public, anon, authenticated;
grant execute on function public.admin_growth_stats(int) to service_role;
