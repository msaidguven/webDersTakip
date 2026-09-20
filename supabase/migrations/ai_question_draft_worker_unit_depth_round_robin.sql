-- Otomatik soru üretimi (20 dakikada bir çalışan ai-question-draft-worker) artık ünite
-- derinliğine göre "round-robin" sırayla ilerliyor — kullanıcının 2026-09-20 isteği:
-- content-draft-worker'a yapılan aynı değişikliğin (ai_content_draft_worker_unit_depth_round_robin.sql)
-- soru üretim tarafındaki karşılığı. Önce şartları taşıyan tüm derslerin 1. ünitelerindeki
-- bölümler tamamlansın, sonra 2. üniteleri, vs. (bir dersi/üniteyi baştan sona bitirip
-- diğerine geçmek yerine).
--
-- Önceki hâli (ai_question_drafts.sql) esas alındı — WHERE filtrelerinin (rag_documents,
-- section_outcomes, pending/saved_want_more/rejected mantığı) HİÇBİRİ değişmedi, sadece
-- ORDER BY'da unit.order_no en öne alındı.
create or replace function public.find_next_ai_question_draft_section()
returns table (
  section_id bigint,
  topic_id bigint,
  unit_id bigint,
  lesson_id bigint,
  grade_id bigint,
  grade_name text,
  lesson_name text,
  unit_title text,
  topic_title text,
  section_heading text
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_draft as (
    select distinct on (d.section_id) d.section_id, d.status
    from public.ai_question_drafts d
    order by d.section_id, d.created_at desc
  ),
  rejected_counts as (
    select d.section_id, count(*) as cnt
    from public.ai_question_drafts d
    where d.status = 'rejected'
    group by d.section_id
  )
  select
    tcs.id as section_id,
    t.id as topic_id,
    u.id as unit_id,
    u.lesson_id,
    u.grade_id,
    g.name as grade_name,
    l.name as lesson_name,
    u.title as unit_title,
    t.title as topic_title,
    tcs.heading as section_heading
  from public.topic_content_sections tcs
  join public.topic_contents tc on tc.id = tcs.topic_content_id
  join public.topics t on t.id = tc.topic_id and t.is_active = true
  join public.units u on u.id = t.unit_id and u.is_active = true
  join public.lessons l on l.id = u.lesson_id and l.is_active = true
  join public.grades g on g.id = u.grade_id and g.is_active = true
  left join latest_draft ld on ld.section_id = tcs.id
  left join rejected_counts rc on rc.section_id = tcs.id
  where exists (select 1 from public.rag_documents rd where rd.unit_id = u.id)
    and exists (select 1 from public.topic_content_section_outcomes tcso where tcso.section_id = tcs.id)
    and (ld.status is null or ld.status <> 'pending')
    and (
      (ld.status is null and not exists (select 1 from public.questions q where q.section_id = tcs.id))
      or ld.status = 'saved_want_more'
      or (ld.status = 'rejected' and coalesce(rc.cnt, 0) < 2)
    )
  order by u.order_no, g.order_no, l.order_no, t.order_no, tcs.order_no
  limit 1;
$$;
