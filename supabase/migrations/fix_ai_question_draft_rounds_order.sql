-- DÜZELTME (2026-10-02): ai_question_draft_rounds.sql'deki sıralama hatası. "Kaydet ve Tekrar
-- Üret" önceliği `(latest_status = 'saved_want_more') desc nulls last` ile yazılmıştı; hiç taslağı
-- olmayan alt başlıkta latest_status NULL → ifade NULL → `nulls last` bu alt başlıkları kaydedilmiş
-- (false) olanların ARKASINA atıyordu. Sonuç: 0. turda uygun 328 alt başlık varken kuyruk 1. turu
-- seçiyordu (canlıda görüldü). coalesce(..., false) ile NULL'lar false sayılıyor. Fonksiyonun geri
-- kalanı aynı; dönüş tipi değişmediği için create or replace yeterli.
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
  section_heading text,
  round_no integer
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
  draft_counts as (
    select d.section_id,
           count(*) filter (where d.status in ('saved', 'saved_want_more')) as saved_rounds,
           count(*) filter (where d.status = 'rejected') as rejected_cnt
    from public.ai_question_drafts d
    group by d.section_id
  ),
  candidates as (
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
      tcs.heading as section_heading,
      ld.status as latest_status,
      coalesce(dc.rejected_cnt, 0) as rejected_cnt,
      (coalesce(dc.saved_rounds, 0)
        + case when coalesce(dc.saved_rounds, 0) = 0
                    and exists (select 1 from public.questions q where q.section_id = tcs.id)
               then 1 else 0 end)::integer as round_no,
      u.order_no as unit_order, g.order_no as grade_order, l.order_no as lesson_order,
      t.order_no as topic_order, tcs.order_no as section_order
    from public.topic_content_sections tcs
    join public.topic_contents tc on tc.id = tcs.topic_content_id
    join public.topics t on t.id = tc.topic_id and t.is_active = true
    join public.units u on u.id = t.unit_id and u.is_active = true
    join public.lessons l on l.id = u.lesson_id and l.is_active = true
    join public.grades g on g.id = u.grade_id and g.is_active = true
    left join latest_draft ld on ld.section_id = tcs.id
    left join draft_counts dc on dc.section_id = tcs.id
    where exists (select 1 from public.rag_documents rd where rd.unit_id = u.id)
      and exists (select 1 from public.topic_content_section_outcomes tcso where tcso.section_id = tcs.id)
  )
  select section_id, topic_id, unit_id, lesson_id, grade_id, grade_name, lesson_name, unit_title,
         topic_title, section_heading, round_no
  from candidates
  where (latest_status is null or latest_status <> 'pending')
    and not (latest_status = 'rejected' and rejected_cnt >= 2)
    and (round_no < 3 or latest_status = 'saved_want_more')
  order by coalesce(latest_status = 'saved_want_more', false) desc,
           round_no, unit_order, grade_order, lesson_order, topic_order, section_order
  limit 1;
$$;

-- Sadece worker (service role) çağırır; önceki sürümlerde açık grant yoktu (varsayılan public).
revoke all on function public.find_next_ai_question_draft_section() from public, anon, authenticated;
grant execute on function public.find_next_ai_question_draft_section() to service_role;
