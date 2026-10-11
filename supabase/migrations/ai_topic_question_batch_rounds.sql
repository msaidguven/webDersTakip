-- Konu partilerine TUR (2026-10-12, kullanıcı kararı; ai_topic_question_batches.sql'in devamı).
-- Eski alt başlık akışındaki 3 tur korunur, her tura konu geneli de eklenir:
--   Bir konunun tamamladığı tur = min(alt başlıkların tur sayısı, konu geneli set sayısı).
--   Alt başlık tur sayısı: eski akışta kaydedilen taslaklar (saved / saved_want_more) + elle eklenmiş
--     soru varsa 1 (eski find_next_ai_question_draft_section ile aynı kural) + yayınlanan parti taslakları.
--   Konu geneli: elle eklenmiş konu geneli soru varsa 1 + yayınlanan konu geneli parti taslakları.
-- Sıra: önce tur numarası (1. tur bütün konularda bitmeden 2. tura geçilmez); aynı turda önce yalnız
-- konu geneli eksik olanlar (ucuz, yarım işi kapatır), sonra müfredat sırası. 3. turdan sonra durur.
-- Bir turda iki kez başarısız olan adım atlanır; konu yine de o turu bitirmiş sayılır (sonsuz döngü yok).

alter table public.ai_question_drafts drop constraint if exists ai_question_drafts_batch_topic_id_fkey;
drop index if exists public.uq_ai_question_drafts_batch_active;

alter table public.ai_topic_question_batches add column if not exists round_no integer not null default 1;
alter table public.ai_topic_question_batches drop constraint if exists ai_topic_question_batches_pkey;
alter table public.ai_topic_question_batches add primary key (topic_id, round_no);

alter table public.ai_question_drafts add column if not exists batch_round integer;
update public.ai_question_drafts set batch_round = 1 where batch_topic_id is not null and batch_round is null;
alter table public.ai_question_drafts
  add constraint ai_question_drafts_batch_fkey foreign key (batch_topic_id, batch_round)
  references public.ai_topic_question_batches (topic_id, round_no) on delete cascade;

create unique index if not exists uq_ai_question_drafts_batch_active
  on public.ai_question_drafts (batch_topic_id, batch_round, coalesce(section_id, 0))
  where status in ('generating', 'batched', 'auto_published');

-- Alt başlığın tamamlanmış tur sayısı.
create or replace function public.section_question_rounds(p_section_id bigint)
returns integer
language sql
stable
set search_path = public
as $$
  select (
    coalesce((select count(*) from ai_question_drafts d where d.section_id = p_section_id and d.batch_topic_id is null and d.status in ('saved', 'saved_want_more')), 0)
    + case
        when not exists (select 1 from ai_question_drafts d where d.section_id = p_section_id and d.batch_topic_id is null and d.status in ('saved', 'saved_want_more'))
         and exists (select 1 from questions q where q.section_id = p_section_id)
        then 1 else 0
      end
    + coalesce((select count(*) from ai_question_drafts d where d.section_id = p_section_id and d.batch_topic_id is not null and d.status = 'auto_published'), 0)
  )::integer;
$$;

-- Konu geneli tamamlanmış set sayısı.
create or replace function public.topic_general_question_rounds(p_topic_id bigint)
returns integer
language sql
stable
set search_path = public
as $$
  select (
    case
      when exists (
        select 1 from questions q
        where q.topic_id = p_topic_id and q.section_id is null
          and not exists (select 1 from ai_question_drafts d where d.batch_topic_id = p_topic_id and d.section_id is null and d.status = 'auto_published')
      ) then 1 else 0
    end
    + coalesce((select count(*) from ai_question_drafts d where d.batch_topic_id = p_topic_id and d.section_id is null and d.status = 'auto_published'), 0)
  )::integer;
$$;

create or replace function public.claim_next_topic_batch_step()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
      select t.id as topic_id, tc.id as tc_id, g.order_no as g_ord, l.order_no as l_ord, u.order_no as u_ord, t.order_no as t_ord
      from topics t
      join units u on u.id = t.unit_id and u.is_active
      join lessons l on l.id = u.lesson_id and l.is_active
      join grades g on g.id = u.grade_id and g.is_active
      join topic_contents tc on tc.topic_id = t.id and tc.is_published
      where t.is_active and not t.is_archived
        and exists (select 1 from lesson_grades lg where lg.lesson_id = l.id and lg.grade_id = g.id and lg.is_active)
        and exists (select 1 from rag_documents rd where rd.unit_id = u.id)
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
    order by target, (sec_min >= target) desc, g_ord, l_ord, u_ord, t_ord, topic_id
    limit 1;

    if v_topic is null then return jsonb_build_object('kind', 'none'); end if;
    insert into ai_topic_question_batches (topic_id, round_no) values (v_topic, v_round);
  end if;

  select u.id, u.lesson_id, u.grade_id into v_unit, v_lesson, v_grade
  from topics t join units u on u.id = t.unit_id where t.id = v_topic;

  -- 1) Bu turu eksik alt başlık.
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

  -- 2) Bu turun konu geneli seti.
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

  -- 3) Toplu yayın.
  update ai_topic_question_batches set status = 'publishing', claimed_at = now() where topic_id = v_topic and round_no = v_round;
  return jsonb_build_object('kind', 'publish', 'topic_id', v_topic, 'round_no', v_round);
end;
$$;

revoke all on function public.claim_next_topic_batch_step() from public, anon, authenticated;
grant execute on function public.claim_next_topic_batch_step() to service_role;
revoke all on function public.section_question_rounds(bigint) from public, anon, authenticated;
revoke all on function public.topic_general_question_rounds(bigint) from public, anon, authenticated;
