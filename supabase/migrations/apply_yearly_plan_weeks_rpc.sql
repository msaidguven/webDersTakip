-- Maarif yıllık plan hafta ataması (app/api/admin/yillik-plan/maarif-weeks) tek transaction'da:
--  1) p_links: kodsuz derslerde sıra eşleştirmesiyle bulunan öğrenme çıktılarını
--     topic_learning_outcomes'a ekler ve kazanımları (outcomes.learning_outcome_id) bağlar.
--  2) p_weeks: verilen kazanımların outcome_weeks satırlarını silip tek aralıkla yeniden yazar.
-- Herhangi bir tutarsızlıkta exception → hiçbir şey yazılmaz (yarım kalmış hafta/kod olmaz).

create or replace function public.apply_yearly_plan_weeks(p_links jsonb, p_weeks jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_link jsonb;
  v_topic_id bigint;
  v_lo_id bigint;
  v_expected int;
  v_updated int;
  v_links int := 0;
  v_weeks int := 0;
begin
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_weeks, '[]'::jsonb)) w
    where (w->>'start_week')::int < 1 or (w->>'end_week')::int > 52 or (w->>'end_week')::int < (w->>'start_week')::int
  ) then
    raise exception 'Geçersiz hafta aralığı';
  end if;

  for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    v_topic_id := (v_link->>'topic_id')::bigint;
    v_expected := jsonb_array_length(v_link->'outcome_ids');

    insert into topic_learning_outcomes (topic_id, code, title, order_no)
    values (v_topic_id, v_link->>'code', v_link->>'title', (v_link->>'order_no')::int)
    returning id into v_lo_id;

    update outcomes set learning_outcome_id = v_lo_id
    where topic_id = v_topic_id
      and learning_outcome_id is null
      and id in (select jsonb_array_elements_text(v_link->'outcome_ids')::bigint);
    get diagnostics v_updated = row_count;
    if v_updated <> v_expected then
      raise exception 'Kazanım bağlantısı tutarsız (konu %, kod %): % beklenen, % güncellendi', v_topic_id, v_link->>'code', v_expected, v_updated;
    end if;
    v_links := v_links + 1;
  end loop;

  delete from outcome_weeks
  where outcome_id in (select (w->>'outcome_id')::bigint from jsonb_array_elements(coalesce(p_weeks, '[]'::jsonb)) w);

  insert into outcome_weeks (outcome_id, start_week, end_week)
  select (w->>'outcome_id')::bigint, (w->>'start_week')::int, (w->>'end_week')::int
  from jsonb_array_elements(coalesce(p_weeks, '[]'::jsonb)) w;
  get diagnostics v_weeks = row_count;

  return jsonb_build_object('links', v_links, 'weeks', v_weeks);
end;
$$;

revoke all on function public.apply_yearly_plan_weeks(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_yearly_plan_weeks(jsonb, jsonb) to service_role;
