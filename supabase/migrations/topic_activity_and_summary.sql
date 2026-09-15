-- Kitapsız/kitaplı fark etmeksizin BUNDAN SONRA üretilecek yeni konu içeriklerinde:
-- her alt başlığın altındaki "Defterine Not Al" kutusunun yerini, klavye gerektirmeyen
-- "Düşün/Hayal Et/Dene" etkinlik kutusu alıyor; konu sonuna da TEK bir toplu özet
-- ekleniyor. Eski satırlarda hepsi NULL kalır — mevcut notebook_markdown ve render'ı
-- olduğu gibi çalışmaya devam eder, geriye dönük hiçbir şey kırılmaz (kullanıcının
-- 2026-09-15 isteği).
alter table public.topic_content_sections
  add column if not exists activity_prompt_markdown text,
  add column if not exists activity_example_markdown text;

alter table public.topic_contents
  add column if not exists summary_markdown text;

-- Öğrencinin etkinliğe verdiği kısa (opsiyonel) kendi notu — SADECE kendisi görür,
-- öğretmene/admin'e açık değil; ödev/değerlendirme sistemi DEĞİL, kişisel tekrar notu.
create table if not exists public.topic_content_section_notes (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.topic_content_sections(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, student_id)
);

create index if not exists idx_topic_content_section_notes_student on public.topic_content_section_notes(student_id);

alter table public.topic_content_section_notes enable row level security;

-- user_topic_content_progress ile aynı desen (bkz. add_user_topic_content_progress_rls.sql):
-- öğrenci SADECE kendi satırını okuyup yazabilir, admin/öğretmen erişimi yok.
create policy topic_content_section_notes_own_select
  on public.topic_content_section_notes for select
  using (auth.uid() = student_id);

create policy topic_content_section_notes_own_insert
  on public.topic_content_section_notes for insert
  with check (auth.uid() = student_id);

create policy topic_content_section_notes_own_update
  on public.topic_content_section_notes for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

create policy topic_content_section_notes_own_delete
  on public.topic_content_section_notes for delete
  using (auth.uid() = student_id);

grant select, insert, update, delete on public.topic_content_section_notes to authenticated;
