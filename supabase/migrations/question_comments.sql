-- Test sorularına öğrenci yorumları: bir soru cevaplandıktan sonra öğrenciler
-- yorum yapabilir ve birbirine yanıt verebilir (tek seviye: yorum + yanıtlar).
-- Hiçbir yorum, admin onaylamadan (status='published') diğer öğrencilere görünmez.
create table if not exists public.question_comments (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.questions(id) on delete cascade,
  parent_comment_id bigint references public.question_comments(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  body text not null,
  status text not null default 'pending' check (status = any (array['pending', 'published', 'rejected'])),
  created_at timestamp with time zone not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamp with time zone
);

create index if not exists idx_question_comments_question_id on public.question_comments(question_id);
create index if not exists idx_question_comments_status on public.question_comments(status);
create index if not exists idx_question_comments_parent on public.question_comments(parent_comment_id);

alter table public.question_comments enable row level security;

-- Öğrenciler yayınlanmış yorumları doğrudan (service role olmadan) okuyabilsin.
drop policy if exists "question_comments_published_public_read" on public.question_comments;
create policy "question_comments_published_public_read" on public.question_comments
  for select using (status = 'published');

-- Giriş yapmış kullanıcı kendi adına, sadece 'pending' statüsüyle yorum ekleyebilir
-- (status='published' ile insert deneyip moderasyonu atlamasını engeller).
drop policy if exists "question_comments_insert_own_pending" on public.question_comments;
create policy "question_comments_insert_own_pending" on public.question_comments
  for insert
  with check (auth.uid() = student_id and status = 'pending');

-- Kullanıcı kendi yorumunu (henüz onaylanmamış olsa bile) her zaman görebilsin —
-- "yorumun inceleniyor" durumunu kendi ekranında görmesi için.
drop policy if exists "question_comments_own_read" on public.question_comments;
create policy "question_comments_own_read" on public.question_comments
  for select using (auth.uid() = student_id);
