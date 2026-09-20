-- Otomatik içerik üretimi (20 dakikada bir çalışan ai-content-draft-worker) artık ünite
-- derinliğine göre "round-robin" sırayla ilerliyor — kullanıcının 2026-09-20 isteği:
-- önce şartları taşıyan tüm derslerin 1. üniteleri tamamlansın, sonra 2. üniteleri, vs.
-- (bir dersi baştan sona bitirip diğerine geçmek yerine).
--
-- Önceki hâli (ai_content_draft_worker_requires_tymm_verified.sql) esas alındı — WHERE
-- filtrelerinin (tymm_verified, rag hazır olma, dedup, kazanım kodu, ret sayısı vb.)
-- HİÇBİRİ değişmedi, sadece ORDER BY'da unit.order_no en öne alındı.
create or replace function public.find_next_ai_content_draft_topic()
returns table (
  topic_id bigint,
  unit_id bigint,
  lesson_id bigint,
  grade_id bigint,
  source_kind text
)
language sql stable security definer set search_path = public
as $$
  with latest_draft as (
    select distinct on (d.topic_id) d.topic_id, d.status
    from public.topic_section_content_drafts d
    order by d.topic_id, d.created_at desc
  ),
  rejected_counts as (
    select d.topic_id, count(*) as cnt
    from public.topic_section_content_drafts d
    where d.status = 'rejected'
    group by d.topic_id
  )
  select
    t.id as topic_id, u.id as unit_id, u.lesson_id, u.grade_id,
    case
      when exists (
        select 1 from public.rag_documents rd
        where rd.topic_id = t.id and rd.source = 'ai_generated' and rd.is_synthesis = true
      ) and u.rag_dedup_checked_at is not null then 'synthesis'
      else 'book'
    end as source_kind
  from public.topics t
  join public.units u on u.id = t.unit_id and u.is_active = true
  join public.lessons l on l.id = u.lesson_id and l.is_active = true
  join public.grades g on g.id = u.grade_id and g.is_active = true
  join public.lesson_grades lg on lg.lesson_id = u.lesson_id and lg.grade_id = u.grade_id and lg.tymm_verified = true
  left join latest_draft ld on ld.topic_id = t.id
  left join rejected_counts rc on rc.topic_id = t.id
  where t.is_active = true
    and (
      (
        exists (
          select 1 from public.rag_documents rd
          where rd.topic_id = t.id and rd.source = 'ai_generated' and rd.is_synthesis = true
        )
        and u.rag_dedup_checked_at is not null
      )
      or exists (select 1 from public.rag_documents rd where rd.unit_id = u.id)
    )
    and not exists (select 1 from public.topic_contents tc where tc.topic_id = t.id)
    and not exists (select 1 from public.outcomes o where o.topic_id = t.id and (o.code is null or trim(o.code) = ''))
    and exists (select 1 from public.outcomes o where o.topic_id = t.id)
    and (ld.topic_id is null or ld.status <> 'pending')
    and (ld.status is null or ld.status <> 'rejected' or coalesce(rc.cnt, 0) < 2)
  order by u.order_no, g.order_no, l.order_no, t.order_no
  limit 1;
$$;
