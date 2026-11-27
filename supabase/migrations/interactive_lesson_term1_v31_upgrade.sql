-- 1. Dönem v3.1 Yükseltme Filtresi — Sondan Geriye Doğru Sıralama (2026-11-27):
-- 2. dönem (start_week > 14) ve haftası atanmamış 4-5. üniteleri şimdilik bekletir.
-- Önce 1. dönem kapsamındaki eski v1 ve eski v3.0 derslerini SONDAN GERİYE DOĞRU:
--   * Hafta atanmışsa: 14. hafta -> 13. -> 12. -> 11. -> ... -> 1. hafta (aynı haftada önce v1, sonra v3.0)
--   * Hafta atanmamışsa: 3. ünitenin son konusu -> sondan bir önceki -> ... -> 1. ünite
-- aynı anda YALNIZCA 1 ders olacak şekilde (sıfır toplu kesinti) v3.1 + öğretmen anlatımına yükseltir.
-- Ardından kalan 1. dönem yeni konularını aynı sırayla üretir.
create or replace function public.claim_next_interactive_lesson_topic(p_exclude bigint[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic bigint;
begin
  -- 1) Öncelik: yarım kalmış (partial) veya yeniden denenebilir (failed / stale generating) dersler.
  select l.topic_id into v_topic
  from public.interactive_lessons l
  where l.runs < 3
    and (l.status = 'partial'
      or (l.status = 'failed' and l.updated_at < now() - interval '50 minutes')
      or (l.status = 'generating' and l.updated_at < now() - interval '30 minutes'))
  order by (l.status = 'partial') desc, l.updated_at
  limit 1
  for update skip locked;

  if v_topic is not null then
    update public.interactive_lessons set status = 'generating', runs = runs + 1, updated_at = now() where topic_id = v_topic;
    return v_topic;
  end if;

  -- 2) Öncelik: 1. dönem kapsamındaki eski v1 ve eski v3.0 derslerini sondan geriye doğru tek tek v3.1'e yükselt.
  with topic_scope as (
    select
      t.id as topic_id,
      coalesce(t.order_no, 0) as topic_order,
      coalesce(u.order_no, 0) as unit_order,
      (
        select min(w.start_week)
        from public.outcomes o
        join public.outcome_weeks w on w.outcome_id = o.id
        where o.topic_id = t.id and o.is_current
      ) as min_week
    from public.topics t
    join public.units u on u.id = t.unit_id
  )
  select l.topic_id into v_topic
  from public.interactive_lessons l
  join topic_scope ts on ts.topic_id = l.topic_id
  where l.status = 'ready'
    and l.voice_done = true
    and not (l.topic_id = any (coalesce(p_exclude, '{}')))
    and ((ts.min_week is not null and ts.min_week <= 14) or (ts.min_week is null and ts.unit_order <= 3))
    and (
      coalesce(l.lesson->>'version', '1') = '1'
      or (l.lesson->>'version' = '3' and coalesce(l.lesson->>'schemaVersion', '') <> '3.1')
    )
    and exists (
      select 1 from public.topic_contents c
      where c.topic_id = l.topic_id and c.is_published
    )
    and (
      select count(*) from public.questions q
      join public.topic_content_sections s on s.id = q.section_id
      join public.topic_contents c2 on c2.id = s.topic_content_id
      where c2.topic_id = l.topic_id and c2.is_published and q.is_active and q.question_type_id in (1, 3)
    ) >= 4
  order by
    (ts.min_week is not null) desc,
    coalesce(ts.min_week, 0) desc,
    ts.unit_order desc,
    ts.topic_order desc,
    (coalesce(l.lesson->>'version', '1') = '1') desc,
    l.topic_id desc
  limit 1
  for update of l skip locked;

  if v_topic is not null then
    update public.interactive_lessons
    set status = 'generating',
        lesson = null,
        runs = 1,
        voice_done = false,
        last_message = '1. dönem sondan geriye otomatik v3.1 yükseltme başladı',
        updated_at = now()
    where topic_id = v_topic;
    return v_topic;
  end if;

  -- 3) Öncelik: 1. dönem kapsamındaki henüz hiç üretilmemiş konular (sondan geriye doğru).
  with topic_scope as (
    select
      t.id as topic_id,
      coalesce(t.order_no, 0) as topic_order,
      coalesce(u.order_no, 0) as unit_order,
      (
        select min(w.start_week)
        from public.outcomes o
        join public.outcome_weeks w on w.outcome_id = o.id
        where o.topic_id = t.id and o.is_current
      ) as min_week
    from public.topics t
    join public.units u on u.id = t.unit_id
  )
  select c.topic_id into v_topic
  from public.topic_contents c
  join topic_scope ts on ts.topic_id = c.topic_id
  where c.is_published
    and not (c.topic_id = any (coalesce(p_exclude, '{}')))
    and ((ts.min_week is not null and ts.min_week <= 14) or (ts.min_week is null and ts.unit_order <= 3))
    and not exists (select 1 from public.interactive_lessons l where l.topic_id = c.topic_id)
    and (
      select count(*) from public.questions q
      join public.topic_content_sections s on s.id = q.section_id
      join public.topic_contents c2 on c2.id = s.topic_content_id
      where c2.topic_id = c.topic_id and c2.is_published and q.is_active and q.question_type_id in (1, 3)
    ) >= 4
  order by
    (ts.min_week is not null) desc,
    coalesce(ts.min_week, 0) desc,
    ts.unit_order desc,
    ts.topic_order desc,
    c.topic_id desc
  limit 1;

  if v_topic is null then
    return null;
  end if;
  insert into public.interactive_lessons (topic_id, status, runs) values (v_topic, 'generating', 1)
  on conflict (topic_id) do nothing;
  return v_topic;
end;
$$;

revoke all on function public.claim_next_interactive_lesson_topic(bigint[]) from public, anon, authenticated;
grant execute on function public.claim_next_interactive_lesson_topic(bigint[]) to service_role;
