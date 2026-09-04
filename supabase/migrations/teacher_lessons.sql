-- Öğretmen kaydı artık sınıf değil branş (birden fazla olabilir) seçiyor — bir
-- öğretmenin resmi branşı tek olsa da pratikte birden fazla derse girebiliyor, bu
-- yüzden tek bir profiles.branch metin alanı yerine çoklu ilişki tablosu kullanıyoruz.
-- Öğretmen panelindeki ders filtresi ve "Derslerim" listesi buradan besleniyor.
create table if not exists public.teacher_lessons (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (teacher_id, lesson_id)
);

alter table public.teacher_lessons enable row level security;

-- Öğretmen kendi ders listesini görebilsin/düzenleyebilsin (kayıt formu ve olası
-- "derslerimi düzenle" ekranı için) — başkasının listesini göremez/değiştiremez.
drop policy if exists "teacher_lessons_own_read" on public.teacher_lessons;
create policy "teacher_lessons_own_read" on public.teacher_lessons
  for select using (auth.uid() = teacher_id);

drop policy if exists "teacher_lessons_own_write" on public.teacher_lessons;
create policy "teacher_lessons_own_write" on public.teacher_lessons
  for insert with check (auth.uid() = teacher_id);

drop policy if exists "teacher_lessons_own_delete" on public.teacher_lessons;
create policy "teacher_lessons_own_delete" on public.teacher_lessons
  for delete using (auth.uid() = teacher_id);
