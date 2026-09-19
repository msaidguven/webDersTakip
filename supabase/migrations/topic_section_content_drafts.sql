-- Soru taslakları (ai_question_drafts) ile aynı desende: RAG sentez metni hazır olan ama
-- henüz alt başlık/içeriği hiç üretilmemiş konular için, "full_from_synthesis" promptunu
-- (bkz. 20-rag-synthesis-full-topic.md) admin'in elle NotebookLM/ChatGPT'ye yapıştırması
-- yerine bir worker'ın otomatik üretip taslak bıraktığı tablo. Admin onaylamadan hiçbir
-- şey yayına gitmez (kullanıcının 2026-09-19 isteği: "ayrı bi tablo ve admin panelde ayrı
-- bi arayüz olsun").
create table if not exists public.topic_section_content_drafts (
  id bigint generated always as identity primary key,
  topic_id bigint not null references public.topics(id) on delete cascade,
  unit_id bigint not null references public.units(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  grade_id bigint not null references public.grades(id) on delete cascade,
  ai_model text,
  cover jsonb,
  sections jsonb not null,
  summary_markdown text,
  discussion_prompt_markdown text,
  status text not null default 'pending' check (status in ('pending', 'saved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create index if not exists idx_topic_section_content_drafts_topic_created on public.topic_section_content_drafts(topic_id, created_at desc);
create index if not exists idx_topic_section_content_drafts_status on public.topic_section_content_drafts(status);

alter table public.topic_section_content_drafts enable row level security;
-- ai_question_drafts ile aynı desen: hiçbir client-erişim policy'si yok, sadece service
-- role (worker route'u) yazar, sadece admin API route'u (requireAdmin) okur.

create table if not exists public.ai_content_draft_worker_runs (
  id bigint generated always as identity primary key,
  generated boolean not null,
  reason text,
  draft_id bigint references public.topic_section_content_drafts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_content_draft_worker_runs_created on public.ai_content_draft_worker_runs(created_at desc);

alter table public.ai_content_draft_worker_runs enable row level security;

-- Bir sonraki uygun konuyu seçer: RAG sentez metni var, kazanım kodları tam, henüz
-- topic_contents'i (yani hiç alt başlığı) yok, ve bekleyen bir taslağı yok. Reddedilen bir
-- konu art arda 2 kez reddedilmişse tekrar denenmez (ai_question_drafts'taki aynı kural).
create or replace function public.find_next_ai_content_draft_topic()
returns table (
  topic_id bigint,
  unit_id bigint,
  lesson_id bigint,
  grade_id bigint
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
  select t.id as topic_id, u.id as unit_id, u.lesson_id, u.grade_id
  from public.topics t
  join public.units u on u.id = t.unit_id and u.is_active = true
  join public.lessons l on l.id = u.lesson_id and l.is_active = true
  join public.grades g on g.id = u.grade_id and g.is_active = true
  left join latest_draft ld on ld.topic_id = t.id
  left join rejected_counts rc on rc.topic_id = t.id
  where t.is_active = true
    and exists (
      select 1 from public.rag_documents rd
      where rd.topic_id = t.id and rd.source = 'ai_generated' and rd.is_synthesis = true
    )
    and not exists (select 1 from public.topic_contents tc where tc.topic_id = t.id)
    and not exists (select 1 from public.outcomes o where o.topic_id = t.id and (o.code is null or trim(o.code) = ''))
    and exists (select 1 from public.outcomes o where o.topic_id = t.id)
    and (ld.topic_id is null or ld.status <> 'pending')
    and (ld.status is null or ld.status <> 'rejected' or coalesce(rc.cnt, 0) < 2)
  order by g.order_no, l.order_no, u.order_no, t.order_no
  limit 1;
$$;

select cron.schedule(
  'ai-content-draft-worker',
  '*/20 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-topic-content',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 360000
  );
  $$
);
