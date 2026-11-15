-- Etkileşimli ders herkese açıldı (kullanıcı kararı 2026-11-03; ilerleme kaydı henüz yok) + üretim sırası.
-- 1) Konu sayfası (anon, ISR) dersi hazır konuları bilmeli ama interactive_lessons dışarıya kapalı (ders JSON'u
--    sunucudan hydrate edilerek verilir): yalnız konu numaralarını döndüren fonksiyon.
-- 2) Üretim sırası "1. ünite 1. konudan itibaren" (kullanıcı kararı 2026-11-03): ünite sırası → konu sırası →
--    sınıf → ders; böylece bütün derslerin 1. üniteleri önce biter. Yeniden deneme kuralları
--    interactive_lesson_generation.sql ile aynı.

create or replace function public.interactive_lesson_ready_topics(p_topic_ids bigint[])
returns setof bigint
language sql
stable
security definer
set search_path = ''
as $$
  select l.topic_id from public.interactive_lessons l
  where l.status = 'ready' and l.topic_id = any (p_topic_ids);
$$;
revoke all on function public.interactive_lesson_ready_topics(bigint[]) from public;
grant execute on function public.interactive_lesson_ready_topics(bigint[]) to anon, authenticated, service_role;

create or replace function public.claim_next_interactive_lesson_topic(p_exclude bigint[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic bigint;
begin
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

  select c.topic_id into v_topic
  from public.topic_contents c
  join public.topics t on t.id = c.topic_id
  join public.units u on u.id = t.unit_id
  join public.grades g on g.id = u.grade_id
  join public.lessons le on le.id = u.lesson_id
  where c.is_published
    and not (c.topic_id = any (coalesce(p_exclude, '{}')))
    and not exists (select 1 from public.interactive_lessons l where l.topic_id = c.topic_id)
    and (
      select count(*) from public.questions q
      join public.topic_content_sections s on s.id = q.section_id
      join public.topic_contents c2 on c2.id = s.topic_content_id
      where c2.topic_id = c.topic_id and c2.is_published and q.is_active and q.question_type_id in (1, 3)
    ) >= 4
  order by u.order_no, t.order_no, g.order_no, le.order_no, c.topic_id
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
