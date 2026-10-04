-- Admin → Yıllık Plan ders listesinde hafta durumu ikonu için: seçili sınıftaki her dersin
-- güncel kazanım sayısı ve bunlardan kaçının outcome_weeks'te haftası olduğu. Satır satır
-- çekmek yerine tek sorguda sayar (PostgREST 1000 satır sınırına da takılmaz).
-- security invoker: çağıranın mevcut okuma yetkileriyle çalışır (bu tablolar zaten herkese açık okunuyor).

create or replace function public.lesson_week_coverage(p_grade_id bigint)
returns table (lesson_id bigint, outcome_count int, with_weeks int)
language sql
stable
security invoker
set search_path = public
as $$
  select u.lesson_id,
         count(*)::int as outcome_count,
         count(*) filter (where exists (select 1 from outcome_weeks ow where ow.outcome_id = o.id))::int as with_weeks
  from outcomes o
  join topics t on t.id = o.topic_id
  join units u on u.id = t.unit_id
  where u.grade_id = p_grade_id
    and o.is_current
    and not t.is_archived
  group by u.lesson_id;
$$;

revoke all on function public.lesson_week_coverage(bigint) from public, anon;
grant execute on function public.lesson_week_coverage(bigint) to authenticated, service_role;
