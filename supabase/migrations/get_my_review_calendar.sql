-- İlerlemem: tekrar takvimi (yol haritası 4g, 2026-09-29). Önümüzdeki p_days günün (varsayılan 7,
-- en fazla 14) her biri için tekrar zamanı gelen soru sayısı, Türkiye takvim gününe göre.
--   - Gecikmiş tekrarlar (next_review_at bugünden önce) "bugün"e sayılır.
--   - ready_now: yalnızca bugünün satırında dolu — ŞU AN hazır olanlar (next_review_at <= now()).
--     /tekrar sayfası sadece bunları açar (bkz. dashboardSrs.getDueSrsQuestionIds); gün içinde
--     daha sonra hazır olacaklar due_count'ta var ama ready_now'da yok.
--   - Kapsam getDueSrsCount ile aynı: aktif sorular; profilde sınıf varsa sadece o sınıf.
-- SECURITY INVOKER + auth.uid(): user_question_stats / profiles RLS'i (kendi satırları) geçerli.

create or replace function public.get_my_review_calendar(p_days integer default 7)
returns table (day date, due_count integer, ready_now integer)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select (now() at time zone 'Europe/Istanbul')::date as today,
           least(greatest(coalesce(p_days, 7), 1), 14) as n
  ),
  me as (
    select p.grade_id from public.profiles p where p.id = auth.uid()
  ),
  days as (
    select (select today from params) + g as day
    from generate_series(0, (select n from params) - 1) g
  ),
  due as (
    select greatest((s.next_review_at at time zone 'Europe/Istanbul')::date, (select today from params)) as day,
           s.next_review_at <= now() as ready
    from public.user_question_stats s
    join public.questions q on q.id = s.question_id and q.is_active
    where s.user_id = auth.uid()
      and s.next_review_at is not null
      and s.next_review_at < (((select today from params) + (select n from params))::timestamp at time zone 'Europe/Istanbul')
      and ((select grade_id from me) is null or s.grade_id = (select grade_id from me))
  )
  select d.day,
         count(due.day)::integer,
         count(due.day) filter (where due.ready)::integer
  from days d
  left join due on due.day = d.day
  group by d.day
  order by d.day;
$$;

revoke all on function public.get_my_review_calendar(integer) from public, anon;
grant execute on function public.get_my_review_calendar(integer) to authenticated;
