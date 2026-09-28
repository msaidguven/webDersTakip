-- İlerlemem: konu haritası (4e) + en çok zorlandığın konular (4f), 2026-09-28.
-- Öğrencinin sınıfındaki her konu için: havuzdaki soru sayısı, çözdüğü farklı soru, son cevabı
-- doğru olan soru. Durum (başlanmadı / zorlanıyorsun / pekişiyor / öğrenildi) istemcide
-- hesaplanır (bkz. app/src/lib/topicMastery.ts) — eşikler tek yerde, SQL'e gömülü değil.
--
-- Tanımlar get_my_lesson_progress ve Soru Bankası rozetleriyle BİREBİR aynı:
--   havuz   = aktif ünite → aktif + arşivlenmemiş konu → aktif, klasik olmayan (type<>4) soru
--   çözülen = user_question_stats'ta total_attempts > 0 olan farklı soru
--   doğru   = sorunun SON cevabı doğru (yanlışını düzelten öğrencinin puanı yükselir)
-- Sorusu olmayan konu dönmez (çözülecek bir şey yok).
-- Kullanıcı auth.uid()'den alınır; başkasının verisi sorgulanamaz.

create or replace function public.get_my_topic_mastery(p_grade_id bigint)
returns table (
  lesson_id bigint,
  lesson_name text,
  lesson_slug text,
  lesson_order integer,
  grade_slug text,
  unit_slug text,
  unit_order integer,
  topic_id bigint,
  topic_title text,
  topic_slug text,
  topic_order integer,
  total_questions integer,
  solved_questions integer,
  correct_answers integer
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  with lessons_in_grade as (
    select l.id, l.name, l.slug, l.order_no
    from public.lesson_grades lg
    join public.lessons l on l.id = lg.lesson_id and l.is_active
    where lg.grade_id = p_grade_id and lg.is_active
  ),
  pool as (
    select u.lesson_id, u.slug as unit_slug, u.order_no as unit_order,
           t.id as topic_id, t.title as topic_title, t.slug as topic_slug, t.order_no as topic_order,
           q.id as question_id
    from public.units u
    join public.topics t on t.unit_id = u.id and t.is_active and not t.is_archived
    join public.questions q on q.topic_id = t.id and q.is_active and q.question_type_id <> 4
    where u.grade_id = p_grade_id
      and u.is_active
      and u.lesson_id in (select id from lessons_in_grade)
  ),
  my_stats as (
    select distinct on (s.question_id) s.question_id, s.last_answer_correct
    from public.user_question_stats s
    where s.user_id = v_user_id
      and s.total_attempts > 0
      and s.question_id in (select question_id from pool)
    order by s.question_id, s.last_answer_at desc nulls last
  )
  select
    lig.id::bigint,
    lig.name::text,
    lig.slug::text,
    lig.order_no::integer,
    (select g.slug from public.grades g where g.id = p_grade_id)::text,
    p.unit_slug::text,
    p.unit_order::integer,
    p.topic_id::bigint,
    p.topic_title::text,
    p.topic_slug::text,
    p.topic_order::integer,
    count(*)::integer,
    count(m.question_id)::integer,
    count(*) filter (where m.last_answer_correct)::integer
  from pool p
  join lessons_in_grade lig on lig.id = p.lesson_id
  left join my_stats m on m.question_id = p.question_id
  group by lig.id, lig.name, lig.slug, lig.order_no, p.unit_slug, p.unit_order, p.topic_id, p.topic_title, p.topic_slug, p.topic_order
  order by lig.order_no nulls last, lig.name, p.unit_order nulls last, p.topic_order nulls last, p.topic_id;
end;
$function$;

revoke all on function public.get_my_topic_mastery(bigint) from public, anon;
grant execute on function public.get_my_topic_mastery(bigint) to authenticated;
