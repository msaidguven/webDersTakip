-- Admin "Üye Aktivitesi" paneli (/admin/uye-aktivitesi, kullanıcı isteği 2026-09-26) için
-- user_page_views üzerinde toplulaştırma. Sadece service_role çağırabilir — API route
-- requireAdmin() ile yetkilendirip service client'la çağırıyor. "Bugün" Türkiye saatine göre.
-- Admin rolündeki kullanıcıların ziyaretleri tüm metriklerden hariç tutulur.

create or replace function public.admin_member_activity_summary(p_days int default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      greatest(1, least(coalesce(p_days, 7), 90)) as days,
      (date_trunc('day', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul') as today_start
  ),
  period as (
    select v.* from public.user_page_views v, params
    where v.created_at >= now() - make_interval(days => params.days)
      and not exists (
        select 1 from public.profiles a where a.id = v.user_id and a.role = 'admin'
      )
  ),
  last_view as (
    select distinct on (user_id) user_id, path, created_at
    from period
    order by user_id, created_at desc
  )
  select jsonb_build_object(
    'days', (select days from params),
    'active_today', (select count(distinct user_id) from period, params where created_at >= params.today_start),
    'views_today', (select count(*) from period, params where created_at >= params.today_start),
    'active_period', (select count(distinct user_id) from period),
    'views_period', (select count(*) from period),
    'top_pages', coalesce((
      select jsonb_agg(t order by t.views desc)
      from (
        select path, count(*) as views, count(distinct user_id) as users
        from period
        group by path
        order by count(*) desc
        limit 20
      ) t
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(m order by m.last_view_at desc)
      from (
        select
          lv.user_id,
          p.full_name,
          p.username,
          p.role,
          (select count(*) from period x where x.user_id = lv.user_id) as views,
          (select count(distinct x.path) from period x where x.user_id = lv.user_id) as pages,
          lv.created_at as last_view_at,
          lv.path as last_path
        from last_view lv
        left join public.profiles p on p.id = lv.user_id
      ) m
    ), '[]'::jsonb)
  );
$$;

create or replace function public.admin_recent_page_views(p_user_id uuid default null, p_limit int default 100)
returns table (user_id uuid, full_name text, username text, path text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.user_id, p.full_name, p.username, v.path, v.created_at
  from public.user_page_views v
  left join public.profiles p on p.id = v.user_id
  where (p_user_id is null or v.user_id = p_user_id)
    and p.role is distinct from 'admin'
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.admin_member_activity_summary(int) from public, anon, authenticated;
revoke all on function public.admin_recent_page_views(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_member_activity_summary(int) to service_role;
grant execute on function public.admin_recent_page_views(uuid, int) to service_role;
