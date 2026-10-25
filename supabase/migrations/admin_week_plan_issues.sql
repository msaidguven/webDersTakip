-- Ders/sınıf bazında kazanım haftası tutarlılığı (admin Akademik Takvim uyarısı, 2026-10-21).
-- Standart: öğretim haftası numaralandırması (tatiller hafta tüketmez, yıl 1–37), ders içeriği en geç
-- 36. haftada biter (37 = sosyal etkinlik). İçerik olmayan hafta yalnız o ders/sınıf için tanımlı özel
-- hafta (special_content / social_activity; ör. Okul Temelli Planlama, Fen lab kuralları) olabilir.
-- Döner: haftası olan her ders+sınıf; max_week > 36 ya da gaps dolu ise sorunlu.
create or replace function public.admin_week_plan_issues()
returns table (grade_id bigint, grade_name text, lesson_id bigint, lesson_name text, max_week int, gaps int[])
language sql
stable
security invoker
set search_path = public
as $$
  with weeks as (
    select u.grade_id, u.lesson_id, gs.wk
    from outcome_weeks ow
    join outcomes o on o.id = ow.outcome_id and o.is_current
    join topics t on t.id = o.topic_id and t.is_active
    join units u on u.id = t.unit_id and u.is_active
    cross join lateral generate_series(ow.start_week, ow.end_week) gs(wk)
  ),
  agg as (
    select w.grade_id, w.lesson_id, max(w.wk) as max_week, array_agg(distinct w.wk) as ws
    from weeks w
    group by w.grade_id, w.lesson_id
  )
  select a.grade_id::bigint, g.name::text, a.lesson_id::bigint, l.name::text, a.max_week::int,
    coalesce((
      select array_agg(x order by x)
      from generate_series(1, least(a.max_week, 36)) x
      where not x = any (a.ws)
        and not exists (
          select 1 from special_week_events e
          where e.is_active
            and e.event_type in ('special_content', 'social_activity')
            and e.curriculum_week = x
            and (e.lesson_id is null or e.lesson_id = a.lesson_id)
            and (e.grade_ids is null or a.grade_id = any (e.grade_ids))
        )
    ), '{}')::int[]
  from agg a
  join grades g on g.id = a.grade_id
  join lessons l on l.id = a.lesson_id
  order by g.order_no, l.name;
$$;

revoke all on function public.admin_week_plan_issues() from public, anon;
grant execute on function public.admin_week_plan_issues() to authenticated;
