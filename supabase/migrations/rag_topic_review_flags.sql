-- RAG kaynak sentezi sırasında AI taslaklarının birbiriyle çelişmesinden doğan "Tutarsızlık
-- Notu" ve yeni "Doğruluk Kontrolü" promptunun bulduğu hatalar için: eskiden bu notlar admin
-- panelde bir kerelik gösterilip kaydedilmeden kayboluyordu (kullanıcının 2026-09-14 isteği:
-- "hataları düzeltmek için ne yapabiliriz, tekrar kontrolü için ne ekleyelim").
create table if not exists public.rag_topic_review_flags (
  id bigint generated always as identity primary key,
  topic_id bigint not null references public.topics(id) on delete cascade,
  section_id bigint references public.topic_content_sections(id) on delete cascade,
  kind text not null check (kind = any (array['synthesis_inconsistency', 'accuracy_check'])),
  note text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create index if not exists idx_rag_topic_review_flags_topic_id on public.rag_topic_review_flags(topic_id);
create index if not exists idx_rag_topic_review_flags_open on public.rag_topic_review_flags(topic_id) where resolved_at is null;

-- Sadece admin API route'ları (service role) okuyup yazıyor; public policy gerekmiyor.
alter table public.rag_topic_review_flags enable row level security;

-- Konu bazında "en son ne zaman kontrol edildi" göstergesi — ünitelerdeki
-- rag_dedup_checked_at'in konu seviyesindeki karşılığı. Sentez kaydedilince, Doğruluk
-- Kontrolü çalıştırılınca (hata bulunsa da bulunmasa da) ve o konuyu değiştiren bir ünite
-- içi tekrar düzeltmesi uygulanınca güncellenir.
alter table public.topics
  add column if not exists rag_last_checked_at timestamptz;
