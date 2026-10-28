-- Soru worker'ı: geçici hata adım atlatmaz, kalıcı hata atlanır ve admin'e bildirilir (2026-10-28, kullanıcı kararı).
-- Worker bir konunun bütün alt başlıkları + konu geneli için soru üretilmeden yeni konuya geçmez (claim RPC zaten
-- 'collecting' partiyi önce seçer). Bozuk olan: Vercel 300 sn'de öldürülen adımı bu RPC 10 dk sonra "zaman aşımı"
-- diye başarısız sayıyor, 2 hak bitince adım atlanıyor ve konu eksik sorularla yayınlanıyordu (9 tur, 12 adım).
--   1. claim_next_topic_batch_step: yarıda kalan taslak başarısız sayılmaz, silinir (adım yeniden denenir).
--      Kod tarafı 429/503/zaman aşımı'nı zaten serbest bırakıyor (topicQuestionBatch.ts TRANSIENT_ERROR + deadlineAt).
--   2. count_failed_topic_batches(): admin uyarısı = 0 soruyla biten partiler + atlanan adımı olan yayınlanmış partiler
--      (içerik/kitap yok, AI çıktısı iki kez bozuk… — kitabı olmayan ünite de dahil, kullanıcı bilgi istiyor).
--   3. Geçici hata yüzünden adımı atlanmış yayınlanmış turlar yeniden açılır: o adımların başarısız taslakları
--      silinir, parti 'collecting' olur; worker yalnız eksik adımları üretir, yayın soru sayısını üstüne ekler.

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

  -- Yarıda kalan üretim (fonksiyon öldürüldü) hak YAKMAZ, serbest bırakılır: aynı adım sonraki çalışmada
  -- yeniden denenir (2026-10-28, kullanıcı kararı: kota/zaman aşımı yüzünden adım atlanmasın).
  delete from ai_question_drafts where status = 'generating' and created_at < now() - interval '10 minutes';
  update ai_topic_question_batches set status = 'collecting', claimed_at = null
  where status = 'publishing' and claimed_at < now() - interval '10 minutes';

  -- 0 soruyla biten tur bir sonrakine GEÇMEZ (2026-10-28): 1 gün sonra aynı tur yeniden açılır; o turun
  -- başarısız taslakları silinir ki deneme hakları sıfırlansın. Kitabı hazır olmayan ünitenin konusu beklemede kalır.
  select b.topic_id, b.round_no into v_topic, v_round
  from ai_topic_question_batches b
  join topics t on t.id = b.topic_id
  where b.status = 'failed' and b.published_at < now() - interval '1 day' and public.unit_rag_source_ready(t.unit_id)
  order by b.round_no, b.published_at limit 1;
  if v_topic is not null then
    delete from ai_question_drafts where batch_topic_id = v_topic and batch_round = v_round and status = 'failed';
    update ai_topic_question_batches set status = 'collecting', started_at = now(), claimed_at = null, published_at = null, last_error = null, question_count = 0, svg_pending_count = 0
    where topic_id = v_topic and round_no = v_round;
    v_topic := null;
  end if;

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
        and not exists (select 1 from ai_topic_question_batches b where b.topic_id = t.id and b.status in ('awaiting_review', 'failed'))
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
$function$;

create or replace function public.count_failed_topic_batches()
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int
  from public.ai_topic_question_batches b
  where b.status = 'failed'
     or (b.status = 'published' and exists (
       select 1 from public.ai_question_drafts d
       where d.batch_topic_id = b.topic_id and d.batch_round = b.round_no and d.status = 'failed'
         and not exists (
           select 1 from public.ai_question_drafts x
           where x.batch_topic_id = d.batch_topic_id and x.batch_round = d.batch_round
             and coalesce(x.section_id, 0) = coalesce(d.section_id, 0) and x.status in ('auto_published', 'batched'))));
$$;
revoke all on function public.count_failed_topic_batches() from public, anon, authenticated;
grant execute on function public.count_failed_topic_batches() to service_role;

with reopen as (
  select distinct d.id, d.batch_topic_id, d.batch_round
  from public.ai_question_drafts d
  join public.ai_topic_question_batches b on b.topic_id = d.batch_topic_id and b.round_no = d.batch_round
  where b.status = 'published' and d.status = 'failed'
    and d.fail_reason ~* '(^|[^0-9])(429|500|502|503|504)([^0-9]|$)|fetch failed|ECONNRESET|ETIMEDOUT|timed? ?out|zaman aşımı|boş cevap'
    and not exists (
      select 1 from public.ai_question_drafts x
      where x.batch_topic_id = d.batch_topic_id and x.batch_round = d.batch_round
        and coalesce(x.section_id, 0) = coalesce(d.section_id, 0) and x.status in ('auto_published', 'batched'))
), deleted as (
  delete from public.ai_question_drafts d using reopen r where d.id = r.id returning r.batch_topic_id, r.batch_round
)
update public.ai_topic_question_batches b
set status = 'collecting', started_at = now(), claimed_at = null, last_error = null
where (b.topic_id, b.round_no) in (select batch_topic_id, batch_round from deleted);

-- Eski yayınlanmış partilerde kalıcı hatayla atlanan adımlar panelde görünsün (yayın kodu artık kendisi yazıyor).
update public.ai_topic_question_batches b
set last_error = left('Atlandı: ' || s.list, 1000)
from (
  select d.batch_topic_id, d.batch_round,
    string_agg(distinct coalesce('"' || cs.heading || '"', 'konu geneli') || ' (' || left(coalesce(d.fail_reason, 'bilinmeyen hata'), 150) || ')', ' · ') as list
  from public.ai_question_drafts d
  left join public.topic_content_sections cs on cs.id = d.section_id
  where d.status = 'failed'
    and not exists (
      select 1 from public.ai_question_drafts x
      where x.batch_topic_id = d.batch_topic_id and x.batch_round = d.batch_round
        and coalesce(x.section_id, 0) = coalesce(d.section_id, 0) and x.status in ('auto_published', 'batched'))
  group by 1, 2
) s
where b.topic_id = s.batch_topic_id and b.round_no = s.batch_round and b.status = 'published' and b.last_error is null;
