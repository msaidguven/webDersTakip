-- Sesli anlatım kuyruğu, içerik ve soru worker'larıyla aynı "ünite derinliği round-robin" sırasına
-- geçiyor (kullanıcının 2026-10-02 sorusu; bkz. ai_question_draft_worker_unit_depth_round_robin.sql):
-- önce tüm derslerin 1. ünitelerindeki konular (ünite içinde konu sırasıyla), sonra 2. üniteler...
-- İlk sürüm (topic_narrations.sql) konu id'sine göre sıralıyordu ve pasif ünite/ders/sınıfları
-- elemiyordu. Yeni konular yine içeriği değişmiş konulardan önce gelir.
create or replace function public.next_topic_for_narration()
returns table (topic_id bigint, source_hash text)
language sql
stable
security definer
set search_path = public
as $$
  with src as (
    select t.id as topic_id,
           public.topic_narration_source_hash(t.id) as source_hash,
           u.order_no as unit_order,
           g.order_no as grade_order,
           l.order_no as lesson_order,
           t.order_no as topic_order
    from public.topics t
    join public.units u on u.id = t.unit_id and u.is_active
    join public.lessons l on l.id = u.lesson_id and l.is_active
    join public.grades g on g.id = u.grade_id and g.is_active
    where t.is_active
      and not t.is_archived
      and exists (
        select 1 from public.topic_contents tc
        join public.topic_content_sections s on s.topic_content_id = tc.id
        where tc.topic_id = t.id and tc.is_published
      )
  )
  select src.topic_id, src.source_hash
  from src
  left join public.topic_narrations n on n.topic_id = src.topic_id
  where (n.topic_id is null or n.source_hash <> src.source_hash)
    and (
      select count(*) from public.topic_narration_worker_runs r
      where r.topic_id = src.topic_id and r.outcome = 'failed' and r.created_at > now() - interval '24 hours'
    ) < 3
  order by (n.topic_id is not null), src.unit_order, src.grade_order, src.lesson_order, src.topic_order, src.topic_id
  limit 1;
$$;

revoke all on function public.next_topic_for_narration() from public, anon, authenticated;
grant execute on function public.next_topic_for_narration() to service_role;
