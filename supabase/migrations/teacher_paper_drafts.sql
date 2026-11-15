-- Öğretmen yazılı taslağı (2026-11-11): öğretmenin seçtiği sorular, sırası, puanları ve başlığı hesabında saklanır;
-- telefonda seçip bilgisayarda açınca aynı kağıdı görsün, indirdiği kağıdı yeniden görüp indirebilsin.
-- Öğretmen + yazılı başına tek satır. Yalnız sunucu route'larından (service role, requireTeacher sonrası) okunur/yazılır;
-- RLS açık, policy yok. Yeni tablo: mevcut hiçbir tabloya/fonksiyona dokunmaz.
create table if not exists public.teacher_paper_drafts (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  exam_id bigint not null references public.exams(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  auto_points boolean not null default true,
  title text,
  updated_at timestamptz not null default now(),
  primary key (teacher_id, exam_id)
);

alter table public.teacher_paper_drafts enable row level security;
revoke all on public.teacher_paper_drafts from anon, authenticated;
