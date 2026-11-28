-- v3.2 Etkileşimli Ders Üretim & Yükseltme Sıralaması — 11. Haftadan Geriye Doğru (2026-11-28):
-- - Haftası atanmamış 3. ünite yedek kuralı kaldırıldı (tüm konuların haftası atanmış).
-- - Kapsam: min(start_week) <= 11 (11. haftada başlamış veya daha önce başlayıp 11. haftada hâlâ süren konular).
-- - Sıralama: ÖNCE etkin hafta (least(max(end_week), 11) DESC: 11 -> 10 -> 9 -> ... -> 1).
--   Böylece 9-12 arası süren aktif bir konu 9. haftaya düşmeyip doğrudan 11. haftada üretilir.
-- - Aynı hafta içinde: hiç dersi olmayan -> v1 -> v3.0 -> v3.1 sırasıyla tek tek v3.2'ye yükseltilir.
create or replace function public.claim_next_interactive_lesson_topic(p_exclude bigint[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic bigint;
  v_exists boolean;
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

  -- 2) Hafta-öncelikli (11 -> 10 -> 9 -> ... -> 1) v3.2 üretim & yükseltme:
  --    Hem hiç dersi olmayanlar hem v1 / v3.0 / v3.1 dersleri aynı hafta düzeninde v3.2'ye alınır.
  with topic_scope as (
    select
      t.id as topic_id,
      coalesce(t.order_no, 0) as topic_order,
      coalesce(u.order_no, 0) as unit_order,
      min(w.start_week) as min_week,
      least(max(coalesce(w.end_week, w.start_week)), 11) as effective_week
    from public.topics t
    join public.units u on u.id = t.unit_id
    join public.outcomes o on o.topic_id = t.id and o.is_current
    join public.outcome_weeks w on w.outcome_id = o.id
    group by t.id, t.order_no, u.order_no
    having min(w.start_week) <= 11
  )
  select ts.topic_id, (l.topic_id is not null)
  into v_topic, v_exists
  from topic_scope ts
  join public.topic_contents c on c.topic_id = ts.topic_id and c.is_published
  left join public.interactive_lessons l on l.topic_id = ts.topic_id
  where not (ts.topic_id = any (coalesce(p_exclude, '{}')))
    and (
      l.topic_id is null
      or (
        l.status = 'ready'
        and l.voice_done = true
        and (
          coalesce(l.lesson->>'version', '1') <> '3'
          or coalesce(l.lesson->>'schemaVersion', '') <> '3.2'
        )
      )
    )
    and (
      select count(*) from public.questions q
      join public.topic_content_sections s on s.id = q.section_id
      join public.topic_contents c2 on c2.id = s.topic_content_id
      where c2.topic_id = ts.topic_id and c2.is_published and q.is_active and q.question_type_id in (1, 3)
    ) >= 4
  order by
    ts.effective_week desc,
    case
      when l.topic_id is null then 0
      when coalesce(l.lesson->>'version', '1') = '1' then 1
      when coalesce(l.lesson->>'schemaVersion', '') = '' then 2
      else 3
    end asc,
    ts.unit_order desc,
    ts.topic_order desc,
    ts.topic_id desc
  limit 1
  for update of c skip locked;

  if v_topic is null then
    return null;
  end if;

  if v_exists then
    update public.interactive_lessons
    set status = 'generating',
        lesson = null,
        runs = 1,
        voice_done = false,
        last_message = '11. haftadan geriye otomatik v3.2 yükseltme başladı',
        updated_at = now()
    where topic_id = v_topic;
  else
    insert into public.interactive_lessons (topic_id, status, runs)
    values (v_topic, 'generating', 1)
    on conflict (topic_id) do nothing;
  end if;

  return v_topic;
end;
$$;

revoke all on function public.claim_next_interactive_lesson_topic(bigint[]) from public, anon, authenticated;
grant execute on function public.claim_next_interactive_lesson_topic(bigint[]) to service_role;
