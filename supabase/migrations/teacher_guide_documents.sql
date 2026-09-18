-- Öğretmen kılavuz kitabı desteği (2026-09-18 kullanıcı talebi): RAG kaynak sistemine hiç
-- dokunmadan (o sistem RAG PDF/AI taslaklarını embed'leyip pgvector ile öğrenci sorularını
-- cevaplamak için arıyor — kılavuz kitap öğretmene özel içerik barındırabileceğinden ORAYA
-- karışmamalı), sadece öğrenciye gösterilecek NİHAİ içerik promptlarını (bkz. topicPacing.ts,
-- prompt/route.ts) beslemek için ayrı, hafif bir depo. Konu bazlı arama/embedding gerekmiyor
-- çünkü içerik üretimi sırasında zaten hangi topic_id için prompt kurduğumuzu biliyoruz.
--
-- rag_documents'daki "PDF yükle -> otomatik işle, 50MB üstü için NotebookLM'e yapıştır"
-- akışı (bkz. RagDocumentsPanel.tsx, processDocument.ts) burada da aynen kullanılıyor;
-- tek fark: chunk+embed yerine PDF'ten çıkarılan ünite metni Gemini ile doğrudan
-- {konu, önerilen ders saati, vurgulanacak noktalar} JSON'una "yapılandırılıyor".

insert into storage.buckets (id, name, public)
values ('teacher-guide-documents', 'teacher-guide-documents', false)
on conflict (id) do nothing;

-- ============================================================
-- teacher_guide_documents: yüklenen her kılavuz kitap PDF'i (veya NotebookLM'den
-- yapıştırılan ünite) için bir kayıt — rag_documents'ın PDF-yükleme kısmına eşdeğer.
-- ============================================================
create table if not exists public.teacher_guide_documents (
  id bigint generated always as identity primary key,
  grade_id bigint not null references public.grades(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  unit_id bigint references public.units(id) on delete set null,
  title text not null,
  source text not null default 'pdf_upload' check (source = any (array['pdf_upload', 'notebooklm_json'])),
  file_path text,
  page_count integer,
  topic_count integer not null default 0,
  status text not null default 'processing' check (status = any (array['processing', 'ready', 'failed'])),
  error_message text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_teacher_guide_documents_grade_lesson on public.teacher_guide_documents(grade_id, lesson_id);
create index if not exists idx_teacher_guide_documents_unit_id on public.teacher_guide_documents(unit_id);

-- ============================================================
-- topic_teacher_guide_notes: konu başına yapılandırılmış kılavuz özeti — içerik üretim
-- promptlarının ve topicPacing.ts'in doğrudan topic_id ile okuduğu asıl veri.
-- recommended_hours: kılavuzun konuya önerdiği ders saati (varsa, pacing hesabında
-- units.duration_hours'un ÖNÜNE geçer — konu bazlı olduğu için daha güvenilir).
-- ============================================================
create table if not exists public.topic_teacher_guide_notes (
  id bigint generated always as identity primary key,
  topic_id bigint not null unique references public.topics(id) on delete cascade,
  document_id bigint references public.teacher_guide_documents(id) on delete set null,
  recommended_hours numeric,
  emphasis_notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.teacher_guide_documents enable row level security;
alter table public.topic_teacher_guide_notes enable row level security;
-- Bilerek hiç policy eklenmedi (rag_documents/rag_document_chunks ile aynı desen) —
-- sadece service-role (admin API route'ları) erişebilir, RLS varsayılan olarak herkesi reddeder.
