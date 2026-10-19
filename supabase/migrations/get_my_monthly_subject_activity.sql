-- İlerlemem "Aylık çizelge": öğrencinin seçilen ayda, Türkiye takvim gününe ve derse göre
-- çözdüğü soru ile doğru sayısı. Gün × ders tablosu istemcide bu satırlardan kurulur.
--
-- Neden RPC: ham cevap satırlarını istemciye çekmek PostgREST'in 1000 satır sınırına takılır ve
-- ders eşlemesi (answer → question → topic → unit → lesson) istemcide birden fazla sorgu demek olur.
-- Burada tek sorgu, gruplama sunucuda. Satır sayısı = ayda aktif olunan gün × ders (en fazla birkaç yüz).
--
-- p_month: ayın herhangi bir günü (istemci YYYY-MM-01 gönderir). Ay sınırı Europe/Istanbul'a göre.
-- SECURITY DEFINER + auth.uid(): get_my_topic_mastery ile aynı desen; başka kullanıcının verisi dönmez.

create or replace function public.get_my_monthly_subject_activity(p_month date)
returns table (day date, lesson_id bigint, answered integer, correct integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_start timestamp with time zone := date_trunc('month', p_month)::timestamp at time zone 'Europe/Istanbul';
  v_end timestamp with time zone := (date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'Europe/Istanbul';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    (a.created_at at time zone 'Europe/Istanbul')::date as day,
    l.id as lesson_id,
    count(*)::integer as answered,
    count(*) filter (where a.is_correct)::integer as correct
  from public.test_session_answers a
  join public.questions q on q.id = a.question_id
  join public.topics t on t.id = q.topic_id
  join public.units u on u.id = t.unit_id
  join public.lessons l on l.id = u.lesson_id
  where a.user_id = v_user_id
    and a.created_at >= v_start
    and a.created_at < v_end
  group by 1, 2
  order by 1, 2;
end;
$$;

revoke all on function public.get_my_monthly_subject_activity(date) from public, anon;
grant execute on function public.get_my_monthly_subject_activity(date) to authenticated;
