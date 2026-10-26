-- Öğretmen yazılı kağıdı olayları (2026-10-25): ileride "öğretmenlerin tercih ettiği sorular" önerisi için
-- veri. Şimdilik yalnız kayıt; hiçbir ekran okumuyor (bkz. memory: yazılı fikir listesi — "en çok seçilen"
-- tek başına görünürlük döngüsü yaratır, olumsuz sinyaller ayrı tutulur).
--   download: kağıt gerçekten indirildi (format pdf/key/word, question_ids kağıttaki sorular, sırasıyla)
--   remove:   sistemin rastgele seçtiği soru öğretmen tarafından kağıttan çıkarıldı (olumsuz sinyal)
--   swap:     "Bu soruyu değiştir" — question_id çıkan, replaced_by gelen soru (olumsuz sinyal)
-- Yazma yalnız sunucu route'larından (service role, requireTeacher/getTeacherAccess sonrası); istemci
-- doğrudan okuyamaz/yazamaz (RLS açık, policy yok).
create table if not exists public.teacher_paper_events (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  exam_id bigint not null references public.exams(id) on delete cascade,
  kind text not null check (kind in ('download', 'remove', 'swap')),
  question_id bigint references public.questions(id) on delete cascade,
  replaced_by bigint references public.questions(id) on delete set null,
  question_ids bigint[],
  format text check (format in ('pdf', 'key', 'word')),
  created_at timestamptz not null default now(),
  check (
    (kind = 'download' and question_ids is not null and format is not null)
    or (kind in ('remove', 'swap') and question_id is not null)
  )
);

create index if not exists teacher_paper_events_exam_kind_idx on public.teacher_paper_events (exam_id, kind, created_at desc);
create index if not exists teacher_paper_events_question_idx on public.teacher_paper_events (question_id) where question_id is not null;

alter table public.teacher_paper_events enable row level security;
revoke all on public.teacher_paper_events from anon, authenticated;
