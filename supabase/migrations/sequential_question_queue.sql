-- "Sıradaki 10 soru" (2026-10-01, kullanıcı kararı): girişli anasayfadaki Derslerim kartlarında
-- her ders için tek buton. Dersin 1. ünitesinin 1. konusundan başlayıp müfredat sırasıyla
-- (ünite sırası → konu sırası → soru id), öğrencinin HİÇ ÇÖZMEDİĞİ sorulardan test kurar.
--
-- Kapsam (Soru Bankası / get_my_topic_mastery ile aynı havuz): aktif ünite → aktif + arşivlenmemiş
-- konu → aktif, klasik olmayan (type<>4) soru; "çözülmüş" = user_question_stats.total_attempts>0
-- (yanlış yapılanlar zaten aralıklı tekrarla geri gelir, burada tekrar edilmez).
--
-- Okul takvimi: dersin bu sınıftaki konularından herhangi biri için güncel kazanım haftası
-- (outcome_weeks, outcomes.is_current) tanımlıysa ders "takvimli" sayılır ve yalnızca okulda
-- p_week'e kadar işlenmiş konular (en erken start_week <= p_week) dahil edilir — öğrenci henüz
-- işlenmemiş konunun sorularıyla karşılaşmasın. Takvimsiz derste müfredatın sonuna kadar gider;
-- yıllık plan aktarıldıkça ders kendiliğinden sınırlanır. p_week istemcide/sunucuda
-- getCurrentCurriculumWeek ile hesaplanır (tatil/dönem başı mantığı TS'te).

-- İç yardımcı: sıralı, çözülmemiş soru kuyruğu. Doğrudan çağrılamaz (grant yok).
create or replace function public.my_lesson_question_queue(p_grade_id bigint, p_lesson_id bigint, p_week integer)
returns table (
  question_id bigint,
  topic_id bigint,
  topic_title text,
  unit_slug text,
  topic_slug text,
  unit_order integer,
  topic_order integer,
  has_calendar boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with topics_in_lesson as (
    select t.id, t.title, t.slug, t.order_no as topic_order, u.slug as unit_slug, u.order_no as unit_order
    from public.units u
    join public.topics t on t.unit_id = u.id and t.is_active and not t.is_archived
    where u.grade_id = p_grade_id and u.lesson_id = p_lesson_id and u.is_active
  ),
  topic_weeks as (
    select o.topic_id, min(w.start_week) as first_week
    from public.outcomes o
    join public.outcome_weeks w on w.outcome_id = o.id
    where o.is_current and o.topic_id in (select id from topics_in_lesson)
    group by o.topic_id
  ),
  cal as (select exists (select 1 from topic_weeks) as has_calendar),
  scoped as (
    select til.*
    from topics_in_lesson til
    left join topic_weeks tw on tw.topic_id = til.id
    where not (select has_calendar from cal)
       or (tw.first_week is not null and tw.first_week <= coalesce(p_week, 0))
  )
  select q.id::bigint, s.id::bigint, s.title::text, s.unit_slug::text, s.slug::text,
         s.unit_order::integer, s.topic_order::integer, (select has_calendar from cal)
  from scoped s
  join public.questions q on q.topic_id = s.id and q.is_active and q.question_type_id <> 4
  where auth.uid() is not null
    and not exists (
      select 1 from public.user_question_stats st
      where st.user_id = auth.uid() and st.question_id = q.id and st.total_attempts > 0
    )
  order by s.unit_order nulls last, s.topic_order nulls last, s.id, q.id;
$$;

revoke all on function public.my_lesson_question_queue(bigint, bigint, integer) from public, anon, authenticated;

-- Testi kuran: sıradaki p_limit (varsayılan 10, en fazla 30) çözülmemiş soru.
create or replace function public.get_my_next_questions(p_grade_id bigint, p_lesson_id bigint, p_week integer, p_limit integer default 10)
returns table (question_id bigint, topic_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select q.question_id, q.topic_id
  from public.my_lesson_question_queue(p_grade_id, p_lesson_id, p_week) q
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

revoke all on function public.get_my_next_questions(bigint, bigint, integer, integer) from public, anon;
grant execute on function public.get_my_next_questions(bigint, bigint, integer, integer) to authenticated;

-- Derslerim kartları: her ders için sıradaki konunun adı/adresi, kapsamda kalan çözülmemiş soru
-- sayısı, takvim var mı, ve öğrenci o konunun anlatımını açmış / "bitirdim" demiş mi
-- (user_topic_content_progress — buton "Konuyu Bitirdim Olarak İşaretle").
create or replace function public.get_my_lesson_next_steps(p_grade_id bigint, p_week integer)
returns table (
  lesson_id bigint,
  remaining integer,
  has_calendar boolean,
  next_topic_id bigint,
  next_topic_title text,
  next_unit_slug text,
  next_topic_slug text,
  next_topic_viewed boolean,
  next_topic_completed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lesson record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  for v_lesson in
    select l.id
    from public.lesson_grades lg
    join public.lessons l on l.id = lg.lesson_id and l.is_active
    where lg.grade_id = p_grade_id and lg.is_active
  loop
    return query
    with q as (select * from public.my_lesson_question_queue(p_grade_id, v_lesson.id, p_week)),
         head as (select * from q limit 1)
    select v_lesson.id::bigint,
           (select count(*) from q)::integer,
           -- Kuyruk boşken de doğru olsun diye ayrı hesaplanır ("işlenen konuların hepsini bitirdin").
           exists (
             select 1
             from public.units u
             join public.topics t on t.unit_id = u.id and t.is_active and not t.is_archived
             join public.outcomes o on o.topic_id = t.id and o.is_current
             join public.outcome_weeks w on w.outcome_id = o.id
             where u.grade_id = p_grade_id and u.lesson_id = v_lesson.id and u.is_active
           ),
           h.topic_id, h.topic_title, h.unit_slug, h.topic_slug,
           coalesce(p.last_viewed_at is not null, false),
           coalesce(p.is_completed, false)
    from (select 1) one
    left join head h on true
    left join public.user_topic_content_progress p on p.user_id = auth.uid() and p.topic_id = h.topic_id;
  end loop;
end;
$$;

revoke all on function public.get_my_lesson_next_steps(bigint, integer) from public, anon;
grant execute on function public.get_my_lesson_next_steps(bigint, integer) to authenticated;
