-- RAG kuyruğu boşken (üç saatte bir, ayrı bir GitHub Actions worker'ı) kitabı yüklü
-- ünitelerdeki, hiç sorusu olmayan alt başlıklar için AI ile taslak soru üretimi
-- (kullanıcının 2026-09-08 isteği). Üretilen sorular DOĞRUDAN questions'a yazılmaz —
-- admin panelinde (Ders Notu RAG > AI Soru Taslakları) gözden geçirilip "Kaydet" ile
-- gerçek soru bankasına aktarılana kadar burada bekler.
create table if not exists public.ai_question_drafts (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.topic_content_sections(id) on delete cascade,
  topic_id bigint not null references public.topics(id) on delete cascade,
  unit_id bigint not null references public.units(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  grade_id bigint not null references public.grades(id) on delete cascade,
  ai_model text,
  questions jsonb not null,
  -- pending: onay bekliyor. saved: admin tuttuklarını kaydetti, bitti (bir daha otomatik
  -- üretilmez). saved_want_more: admin tuttuklarını kaydetti AMA bu alt başlık için tekrar
  -- üretim istedi (kullanıcının "iyi sorular var ama daha fazla istiyorum" senaryosu).
  -- rejected: hiçbiri kaydedilmeden tamamen reddedildi (art arda 2 rejected'tan sonra
  -- otomatik tekrar denenmez, bkz. find_next_ai_question_draft_section).
  status text not null default 'pending' check (status in ('pending', 'saved', 'saved_want_more', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

create index if not exists idx_ai_question_drafts_section_created on public.ai_question_drafts(section_id, created_at desc);
create index if not exists idx_ai_question_drafts_status on public.ai_question_drafts(status);

alter table public.ai_question_drafts enable row level security;
-- Kasıtlı olarak hiçbir client-erişim policy'si yok — rag_documents/rag_document_chunks ile
-- aynı desen (bkz. add_rag_document_qa.sql): sadece admin API route'ları (service role,
-- requireAdmin() ile) dokunur.

-- Bir sonraki uygun alt başlığı bulur: müfredat sırasına göre (sınıf->ders->ünite->konu->alt
-- başlık), kitabı yüklü bir ünitede, en az bir kazanımı bağlı, ve (hiç işlem görmemiş + sorusu
-- yok) VEYA (son taslağı "saved_want_more") VEYA (son taslağı "rejected" ve art arda red
-- sayısı 2'den az). Bekleyen (pending) bir taslağı olan alt başlık HER ZAMAN atlanır.
create or replace function public.find_next_ai_question_draft_section()
returns table (
  section_id bigint,
  topic_id bigint,
  unit_id bigint,
  lesson_id bigint,
  grade_id bigint,
  grade_name text,
  lesson_name text,
  unit_title text,
  topic_title text,
  section_heading text
)
language sql
stable
security definer
set search_path = public
as $$
  with latest_draft as (
    select distinct on (d.section_id) d.section_id, d.status
    from public.ai_question_drafts d
    order by d.section_id, d.created_at desc
  ),
  rejected_counts as (
    select d.section_id, count(*) as cnt
    from public.ai_question_drafts d
    where d.status = 'rejected'
    group by d.section_id
  )
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
    tcs.heading as section_heading
  from public.topic_content_sections tcs
  join public.topic_contents tc on tc.id = tcs.topic_content_id
  join public.topics t on t.id = tc.topic_id and t.is_active = true
  join public.units u on u.id = t.unit_id and u.is_active = true
  join public.lessons l on l.id = u.lesson_id and l.is_active = true
  join public.grades g on g.id = u.grade_id and g.is_active = true
  left join latest_draft ld on ld.section_id = tcs.id
  left join rejected_counts rc on rc.section_id = tcs.id
  where exists (select 1 from public.rag_documents rd where rd.unit_id = u.id)
    and exists (select 1 from public.topic_content_section_outcomes tcso where tcso.section_id = tcs.id)
    and (ld.status is null or ld.status <> 'pending')
    and (
      (ld.status is null and not exists (select 1 from public.questions q where q.section_id = tcs.id))
      or ld.status = 'saved_want_more'
      or (ld.status = 'rejected' and coalesce(rc.cnt, 0) < 2)
    )
  order by g.order_no, l.order_no, u.order_no, t.order_no, tcs.order_no
  limit 1;
$$;
