-- 2026-10-26: rag_unit_ready_gate.sql öncesi açık kapıdan, Sentezle + Tekilleştir yapılmadan
-- yayınlanan 5. sınıf Bilişim konuları (829–836) silinmiyor (kullanıcı kararı: v0 olarak
-- yayında kalsın, Google dizinlesin). Ünite 3 aşamayı bitirince içerik worker'ı v1'i aynı
-- konunun üzerine yazar.
--
--   * regen_after_rag = true → içerik worker'ı, ünite hazır olduğunda (sentez + tekilleştirme
--     ya da gerçek kitap — diğer şartlar aynı) konuyu "içeriği yok" gibi seçer; yayınlayınca
--     bayrağı indirir (aiContentDraftGen.ts).
--   * Soru worker'ları (alt başlık + konu partisi) bayraklı konuları atlar: v0'ın alt
--     başlıkları v1'de değişeceği için sorular yalnız v1 üzerine üretilir.
--   * Sesli anlatım (topic_narration_source_hash) ve konu PDF önbelleği içerik hash'ine bağlı,
--     v1 yayınlanınca kendiliğinden yenilenir.

alter table public.topic_contents
  add column if not exists regen_after_rag boolean not null default false;

update public.topic_contents set regen_after_rag = true where topic_id between 829 and 836;

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
      or exists (
        select 1 from public.rag_documents rd
        where rd.unit_id = u.id and rd.source <> 'ai_generated'
      )
    )
    and not exists (select 1 from public.topic_contents tc where tc.topic_id = t.id and not tc.regen_after_rag)
    and not exists (
      select 1 from public.outcomes o
      where o.topic_id = t.id and o.is_current = true and (o.code is null or trim(o.code) = '')
    )
    and exists (select 1 from public.outcomes o where o.topic_id = t.id and o.is_current = true)
    and (ld.topic_id is null or ld.status <> 'pending')
    and (ld.status is null or ld.status <> 'rejected' or coalesce(rc.cnt, 0) < 2)
  order by u.order_no, g.order_no, l.order_no, t.order_no
  limit 1;
$$;

CREATE OR REPLACE FUNCTION public.find_next_ai_question_draft_section()
 RETURNS TABLE(section_id bigint, topic_id bigint, unit_id bigint, lesson_id bigint, grade_id bigint, grade_name text, lesson_name text, unit_title text, topic_title text, section_heading text, round_no integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    join public.topic_contents tc on tc.id = tcs.topic_content_id and not tc.regen_after_rag
    join public.topics t on t.id = tc.topic_id and t.is_active = true
    join public.units u on u.id = t.unit_id and u.is_active = true
    join public.lessons l on l.id = u.lesson_id and l.is_active = true
    join public.grades g on g.id = u.grade_id and g.is_active = true
    left join latest_draft ld on ld.section_id = tcs.id
    left join draft_counts dc on dc.section_id = tcs.id
    where public.unit_rag_source_ready(u.id)
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
$function$

;

CREATE OR REPLACE FUNCTION public.claim_next_topic_batch_step()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_max_rounds constant int := 3;
  v_topic bigint;
  v_round int;
  v_unit bigint;
  v_lesson bigint;
  v_grade bigint;
  v_section bigint;
  v_draft bigint;
begin
  perform pg_advisory_xact_lock(hashtext('ai_topic_question_batch'));

  update ai_question_drafts set status = 'failed', fail_reason = coalesce(fail_reason, 'zaman aşımı')
  where status = 'generating' and created_at < now() - interval '10 minutes';
  update ai_topic_question_batches set status = 'collecting', claimed_at = null
  where status = 'publishing' and claimed_at < now() - interval '10 minutes';

  select topic_id, round_no into v_topic, v_round
  from ai_topic_question_batches where status = 'collecting' order by round_no, started_at limit 1;

  if v_topic is null then
    with elig as (
      select t.id as topic_id, tc.id as tc_id, g.order_no as g_ord, l.order_no as l_ord,
        -- Ünite/konu SIRASI (order_no değil): bazı derslerde numaralama 0'dan başlıyor.
        (select count(*) from units u2 where u2.lesson_id = u.lesson_id and u2.grade_id = u.grade_id and u2.is_active and u2.order_no < u.order_no) as u_idx,
        (select count(*) from topics t2 where t2.unit_id = t.unit_id and t2.is_active and not t2.is_archived and t2.order_no < t.order_no) as t_idx
      from topics t
      join units u on u.id = t.unit_id and u.is_active
      join lessons l on l.id = u.lesson_id and l.is_active
      join grades g on g.id = u.grade_id and g.is_active
      join topic_contents tc on tc.topic_id = t.id and tc.is_published and not tc.regen_after_rag
      where t.is_active and not t.is_archived
        and exists (select 1 from lesson_grades lg where lg.lesson_id = l.id and lg.grade_id = g.id and lg.is_active)
        and public.unit_rag_source_ready(u.id)
        and not exists (select 1 from ai_topic_question_batches b where b.topic_id = t.id and b.status = 'awaiting_review')
    ),
    levels as (
      select e.*,
        (select min(section_question_rounds(s.id)) from topic_content_sections s
          where s.topic_content_id = e.tc_id and exists (select 1 from topic_content_section_outcomes o where o.section_id = s.id)) as sec_min,
        topic_general_question_rounds(e.topic_id) as gen_cnt,
        coalesce((select max(b.round_no) from ai_topic_question_batches b where b.topic_id = e.topic_id), 0) as batch_max
      from elig e
    ),
    targets as (
      select *, greatest(least(sec_min, gen_cnt), batch_max) + 1 as target
      from levels where sec_min is not null
    )
    select topic_id, target into v_topic, v_round
    from targets
    where target <= v_max_rounds
    order by target, u_idx, t_idx, g_ord, l_ord, topic_id
    limit 1;

    if v_topic is null then return jsonb_build_object('kind', 'none'); end if;
    insert into ai_topic_question_batches (topic_id, round_no) values (v_topic, v_round);
  end if;

  select u.id, u.lesson_id, u.grade_id into v_unit, v_lesson, v_grade
  from topics t join units u on u.id = t.unit_id where t.id = v_topic;

  select s.id into v_section
  from topic_content_sections s
  join topic_contents tc on tc.id = s.topic_content_id and tc.topic_id = v_topic and tc.is_published
  where exists (select 1 from topic_content_section_outcomes o where o.section_id = s.id)
    and section_question_rounds(s.id) < v_round
    and not exists (
      select 1 from ai_question_drafts d
      where d.batch_topic_id = v_topic and d.batch_round = v_round and d.section_id = s.id and d.status in ('generating', 'batched', 'auto_published')
    )
    and (select count(*) from ai_question_drafts d
         where d.batch_topic_id = v_topic and d.batch_round = v_round and d.section_id = s.id and d.status = 'failed') < 2
  order by s.order_no, s.id
  limit 1;

  if v_section is not null then
    insert into ai_question_drafts (section_id, topic_id, unit_id, lesson_id, grade_id, questions, status, batch_topic_id, batch_round)
    values (v_section, v_topic, v_unit, v_lesson, v_grade, '[]'::jsonb, 'generating', v_topic, v_round)
    returning id into v_draft;
    return jsonb_build_object('kind', 'section', 'draft_id', v_draft, 'topic_id', v_topic, 'round_no', v_round, 'section_id', v_section);
  end if;

  if exists (select 1 from ai_question_drafts d where d.batch_topic_id = v_topic and d.batch_round = v_round and d.status = 'generating') then
    return jsonb_build_object('kind', 'wait', 'topic_id', v_topic, 'round_no', v_round);
  end if;

  if topic_general_question_rounds(v_topic) < v_round
     and not exists (
       select 1 from ai_question_drafts d
       where d.batch_topic_id = v_topic and d.batch_round = v_round and d.section_id is null and d.status in ('batched', 'auto_published')
     )
     and (select count(*) from ai_question_drafts d
          where d.batch_topic_id = v_topic and d.batch_round = v_round and d.section_id is null and d.status = 'failed') < 2
  then
    insert into ai_question_drafts (section_id, topic_id, unit_id, lesson_id, grade_id, questions, status, batch_topic_id, batch_round)
    values (null, v_topic, v_unit, v_lesson, v_grade, '[]'::jsonb, 'generating', v_topic, v_round)
    returning id into v_draft;
    return jsonb_build_object('kind', 'topic', 'draft_id', v_draft, 'topic_id', v_topic, 'round_no', v_round);
  end if;

  update ai_topic_question_batches set status = 'publishing', claimed_at = now() where topic_id = v_topic and round_no = v_round;
  return jsonb_build_object('kind', 'publish', 'topic_id', v_topic, 'round_no', v_round);
end;
$function$

;
