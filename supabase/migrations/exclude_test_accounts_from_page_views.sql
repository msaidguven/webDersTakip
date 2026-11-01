-- Üye Aktivitesi: test hesapları da (profiles.is_test_account) adminler gibi hiç kaydedilmesin ve
-- görünmesin (kullanıcı isteği 2026-11-01). exclude_admins_from_page_views.sql + admin_member_detail.sql
-- ile aynı fonksiyonlar; tek fark her admin kontrolüne "or is_test_account" eklenmesi.

-- 1) Yazma: test hesabının ziyareti tabloya hiç girmez (last_seen_at güncellenmeye devam eder).
create or replace function public.track_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_skip boolean;
begin
  if v_uid is null or p_path is null or p_path !~ '^/' or char_length(p_path) > 500 then
    return;
  end if;

  select role = 'admin' or is_test_account into v_skip from public.profiles where id = v_uid;

  -- Aynı sayfanın 30 sn içinde tekrar kaydı (yenileme, geri/ileri) gürültü — atla.
  if not coalesce(v_skip, false) and not exists (
    select 1 from public.user_page_views
    where user_id = v_uid and path = p_path and created_at > now() - interval '30 seconds'
  ) then
    insert into public.user_page_views (user_id, path) values (v_uid, p_path);
  end if;

  -- profiles satırını her sayfada yazmamak için 1 dk'dan eskiyse güncelle.
  update public.profiles
     set last_seen_at = now()
   where id = v_uid
     and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
end;
$$;

revoke all on function public.track_page_view(text) from public, anon;
grant execute on function public.track_page_view(text) to authenticated;

-- 2) Okuma: sonradan test işaretlenen hesabın eski kayıtları da özet, akış ve üye listesinde görünmez.
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
        select 1 from public.profiles a where a.id = v.user_id and (a.role = 'admin' or a.is_test_account)
      )
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
    and not coalesce(p.is_test_account, false)
  order by v.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create or replace function public.admin_member_directory(p_search text default null, p_limit int default 300)
returns table (
  user_id uuid,
  full_name text,
  username text,
  role text,
  grade_name text,
  registered_at timestamptz,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select '%' || replace(replace(replace(coalesce(p_search, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select p.id, p.full_name, p.username, p.role, g.name, u.created_at, p.last_seen_at
  from public.profiles p
  cross join q
  left join public.grades g on g.id = p.grade_id
  left join auth.users u on u.id = p.id
  where p.role is distinct from 'admin'
    and not p.is_test_account
    and (
      coalesce(p_search, '') = ''
      or p.full_name ilike q.pat
      or p.username ilike q.pat
    )
  order by p.last_seen_at desc nulls last, p.id
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$$;

revoke all on function public.admin_member_activity_summary(int) from public, anon, authenticated;
revoke all on function public.admin_recent_page_views(uuid, int) from public, anon, authenticated;
revoke all on function public.admin_member_directory(text, int) from public, anon, authenticated;
grant execute on function public.admin_member_activity_summary(int) to service_role;
grant execute on function public.admin_recent_page_views(uuid, int) to service_role;
grant execute on function public.admin_member_directory(text, int) to service_role;

-- 3) Mevcut test hesabı kayıtlarını sil (geri alınamaz).
delete from public.user_page_views v
using public.profiles p
where p.id = v.user_id and p.is_test_account;
