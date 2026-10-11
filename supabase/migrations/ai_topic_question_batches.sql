-- Konu bazlı otomatik soru partisi (2026-10-12, kullanıcı kararı: AI soruları admin onayı olmadan,
-- ikinci bir AI kontrolünden geçip yayınlanır).
--
-- Akış (worker her çağrıda TEK adım yapar, bkz. app/src/lib/topicQuestionBatch.ts):
--   1. Müfredat sırasıyla (sınıf → ders → ünite → konu) partisi olmayan ilk uygun konu seçilir.
--   2. Konunun her alt başlığına soru üretilir + AI kontrolü → taslak 'batched' (YAYINDA DEĞİL).
--   3. Hepsi bitince konu geneli 10-15 soru üretilir + AI kontrolü → 'batched'.
--   4. Konunun tüm taslakları TEK seferde soru bankasına yazılır ('auto_published'), sayfa önbelleği
--      konu için BİR kez yenilenir. SVG isteyen sorular çizim eklenene kadar pasif kalır (admin uyarısı).
-- Her konu bir kez işlenir (topic_id birincil anahtar). Eski alt başlık worker'ı (find_next_ai_question_
-- draft_section, admin onaylı 'pending' taslaklar) silinmedi; worker route'u artık bu akışı kullanıyor.

create table if not exists public.ai_topic_question_batches (
  topic_id bigint primary key references public.topics(id) on delete cascade,
  status text not null default 'collecting' check (status in ('collecting', 'publishing', 'published', 'failed')),
  started_at timestamptz not null default now(),
  -- 'publishing' adımını kapan worker'ın zamanı — yarıda ölürse 10 dk sonra yeniden denenir.
  claimed_at timestamptz,
  published_at timestamptz,
  question_count integer,
  svg_pending_count integer,
  last_error text
);
alter table public.ai_topic_question_batches enable row level security;
-- Politika yok: yalnız service role (worker, admin API) okur/yazar.

alter table public.ai_question_drafts alter column section_id drop not null;  -- null = konu geneli
alter table public.ai_question_drafts add column if not exists batch_topic_id bigint references public.ai_topic_question_batches(topic_id) on delete cascade;
alter table public.ai_question_drafts add column if not exists fail_reason text;
alter table public.ai_question_drafts drop constraint if exists ai_question_drafts_status_check;
alter table public.ai_question_drafts add constraint ai_question_drafts_status_check
  check (status in ('pending', 'saved', 'saved_want_more', 'rejected', 'generating', 'batched', 'failed', 'auto_published'));

-- Bir partide bir alt başlığın (ya da konu genelinin) aynı anda tek etkin taslağı olur.
create unique index if not exists uq_ai_question_drafts_batch_active
  on public.ai_question_drafts (batch_topic_id, coalesce(section_id, 0))
  where status in ('generating', 'batched', 'auto_published');
create index if not exists idx_ai_question_drafts_batch on public.ai_question_drafts (batch_topic_id) where batch_topic_id is not null;

-- Sıradaki adımı atomik olarak kapar. Dönüş:
--   {"kind":"section","draft_id","topic_id","section_id"} | {"kind":"topic","draft_id","topic_id"}
--   {"kind":"publish","topic_id"} | {"kind":"wait","topic_id"} | {"kind":"none"}
create or replace function public.claim_next_topic_batch_step()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_topic bigint;
  v_unit bigint;
  v_lesson bigint;
  v_grade bigint;
  v_section bigint;
  v_draft bigint;
begin
  -- Aynı anda çalışan soru worker'ları aynı adımı almasın.
  perform pg_advisory_xact_lock(hashtext('ai_topic_question_batch'));

  -- Worker zaman aşımına uğrayıp yarıda kalan üretimler başarısız sayılır (en fazla 2 deneme).
  update ai_question_drafts set status = 'failed', fail_reason = coalesce(fail_reason, 'zaman aşımı')
  where status = 'generating' and created_at < now() - interval '10 minutes';
  update ai_topic_question_batches set status = 'collecting', claimed_at = null
  where status = 'publishing' and claimed_at < now() - interval '10 minutes';

  select topic_id into v_topic from ai_topic_question_batches where status = 'collecting' order by started_at limit 1;

  if v_topic is null then
    select t.id into v_topic
    from topics t
    join units u on u.id = t.unit_id and u.is_active
    join lessons l on l.id = u.lesson_id and l.is_active
    join grades g on g.id = u.grade_id and g.is_active
    join topic_contents tc on tc.topic_id = t.id and tc.is_published
    where t.is_active and not t.is_archived
      and exists (select 1 from lesson_grades lg where lg.lesson_id = l.id and lg.grade_id = g.id and lg.is_active)
      and exists (select 1 from rag_documents rd where rd.unit_id = u.id)
      and exists (
        select 1 from topic_content_sections s join topic_content_section_outcomes o on o.section_id = s.id
        where s.topic_content_id = tc.id
      )
      and not exists (select 1 from ai_topic_question_batches b where b.topic_id = t.id)
    order by g.order_no, l.order_no, u.order_no, t.order_no, t.id
    limit 1;
    if v_topic is null then return jsonb_build_object('kind', 'none'); end if;
    insert into ai_topic_question_batches (topic_id) values (v_topic);
  end if;

  select u.id, u.lesson_id, u.grade_id into v_unit, v_lesson, v_grade
  from topics t join units u on u.id = t.unit_id where t.id = v_topic;

  -- 1) Sıradaki alt başlık: bu partide etkin taslağı olmayan, en fazla 1 kez başarısız olmuş.
  select s.id into v_section
  from topic_content_sections s
  join topic_contents tc on tc.id = s.topic_content_id and tc.topic_id = v_topic and tc.is_published
  where exists (select 1 from topic_content_section_outcomes o where o.section_id = s.id)
    and not exists (
      select 1 from ai_question_drafts d
      where d.batch_topic_id = v_topic and d.section_id = s.id and d.status in ('generating', 'batched', 'auto_published')
    )
    and (select count(*) from ai_question_drafts d where d.batch_topic_id = v_topic and d.section_id = s.id and d.status = 'failed') < 2
  order by s.order_no, s.id
  limit 1;

  if v_section is not null then
    insert into ai_question_drafts (section_id, topic_id, unit_id, lesson_id, grade_id, questions, status, batch_topic_id)
    values (v_section, v_topic, v_unit, v_lesson, v_grade, '[]'::jsonb, 'generating', v_topic)
    returning id into v_draft;
    return jsonb_build_object('kind', 'section', 'draft_id', v_draft, 'topic_id', v_topic, 'section_id', v_section);
  end if;

  -- Başka bir worker hâlâ alt başlık üretiyorsa konu geneli onu beklesin (tekrar etmesin diye).
  if exists (select 1 from ai_question_drafts d where d.batch_topic_id = v_topic and d.status = 'generating') then
    return jsonb_build_object('kind', 'wait', 'topic_id', v_topic);
  end if;

  -- 2) Konu geneli soru (section_id null).
  if not exists (
       select 1 from ai_question_drafts d
       where d.batch_topic_id = v_topic and d.section_id is null and d.status in ('batched', 'auto_published')
     )
     and (select count(*) from ai_question_drafts d where d.batch_topic_id = v_topic and d.section_id is null and d.status = 'failed') < 2
  then
    insert into ai_question_drafts (section_id, topic_id, unit_id, lesson_id, grade_id, questions, status, batch_topic_id)
    values (null, v_topic, v_unit, v_lesson, v_grade, '[]'::jsonb, 'generating', v_topic)
    returning id into v_draft;
    return jsonb_build_object('kind', 'topic', 'draft_id', v_draft, 'topic_id', v_topic);
  end if;

  -- 3) Toplu yayın.
  update ai_topic_question_batches set status = 'publishing', claimed_at = now() where topic_id = v_topic;
  return jsonb_build_object('kind', 'publish', 'topic_id', v_topic);
end;
$$;

revoke all on function public.claim_next_topic_batch_step() from public, anon, authenticated;
grant execute on function public.claim_next_topic_batch_step() to service_role;
