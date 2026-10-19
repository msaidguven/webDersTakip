-- Admin "Üye Aktivitesi" detay görünümü (2026-10-18): sol kenarda tüm üyeler, sağda seçilen
-- üyenin profil doluluğu, dönem özeti, ders bazında gün/soru/doğru tablosu.
-- Sadece service_role çağırabilir — API route'ları requireAdmin() ile yetkilendirip service client'la
-- çağırıyor. Admin rolündeki hesaplar tüm çıktılardan hariç. Gün = Türkiye takvim günü.
--
-- Bu dosya admin_member_activity_summary'yi de yeniden tanımlar: üye listesi artık
-- admin_member_directory'den geliyor, eski "members" alanı çıkarıldı.

-- 1) Özet (tiles + en çok ziyaret edilen sayfalar). Önceki sürümle aynı, yalnızca members yok.
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

-- 2) Sol kenar çubuğu: admin olmayan tüm üyeler, son görülmeye göre. p_search ad/kullanıcı adında
-- arar; LIKE joker karakterleri (% _ \) kullanıcı girdisinden kaçırılır.
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
    and (
      coalesce(p_search, '') = ''
      or p.full_name ilike q.pat
      or p.username ilike q.pat
    )
  order by p.last_seen_at desc nulls last, p.id
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$$;

-- 3) Seçilen üyenin detayı. Üye yoksa ya da admin ise null döner.
--  - profile.checklist: ad, kullanıcı adı, sınıf, okul, profil tamamlandı
--  - period: seçilen dönemde aktif gün (sayfa görüntüleme veya soru cevabı olan takvim günü), soru, doğru, sayfa
--  - totals: tüm zamanlar + kayıttan sonraki 7 günde çözülen soru (ilk hafta 10 soru eşiği)
--  - lessons: seçilen dönemde çözülen derslere göre gün/soru/doğru
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
      p.full_name, p.username, p.school_name, p.branch, p.daily_goal, p.onboarding_completed,
      p.last_seen_at, g.name as grade_name, u.created_at as registered_at
    from public.profiles p
    left join public.grades g on g.id = p.grade_id
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
    ),
    'lessons', coalesce((
      select jsonb_agg(x order by x.lesson_order)
      from (
        select
          pa.lesson_id,
          pa.lesson_name,
          pa.lesson_order,
          count(distinct (pa.created_at at time zone 'Europe/Istanbul')::date) as active_days,
          count(*) as answered,
          count(*) filter (where pa.is_correct) as correct
        from period_answers pa
        group by pa.lesson_id, pa.lesson_name, pa.lesson_order
      ) x
    ), '[]'::jsonb)
  ) end;
$$;

revoke all on function public.admin_member_activity_summary(int) from public, anon, authenticated;
revoke all on function public.admin_member_directory(text, int) from public, anon, authenticated;
revoke all on function public.admin_member_detail(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_member_activity_summary(int) to service_role;
grant execute on function public.admin_member_directory(text, int) to service_role;
grant execute on function public.admin_member_detail(uuid, int) to service_role;
