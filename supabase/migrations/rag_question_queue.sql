-- AI'ye (@hocam/@kanka) sorulan sorular artık senkron cevaplanmıyor — Gemini'nin
-- ücretsiz katmanının dakikalık istek limitine (RPM), aynı anda birden fazla
-- öğrenci soru sorduğunda çok çabuk takılıyordu. Soru önce buraya kuyruğa alınıyor;
-- bir worker (bkz. app/api/rag/process-queue, GitHub Actions'ta 5 dakikada bir
-- tetikleniyor) sırayla birkaçını işleyip normal şekilde rag_answers'a yazıyor.
-- rag_answers şeması hiç değişmiyor (answer hâlâ NOT NULL) — bu tablo sadece
-- "henüz cevabı üretilmemiş" geçici aşamayı tutuyor, işlenince (başarılı da olsa
-- başarısız da olsa) buradan kalkıyor (worker satırı siliyor, ayrı bir arşiv değil).
create table if not exists public.rag_question_queue (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id),
  grade_id bigint not null references public.grades(id),
  lesson_id bigint not null references public.lessons(id),
  unit_id bigint references public.units(id),
  quiz_question_id bigint references public.questions(id),
  question text not null,
  question_context text,
  reply_context text,
  mode text not null check (mode = any (array['hocam', 'kanka'])),
  parent_comment_id bigint references public.question_comments(id),
  parent_rag_answer_id bigint references public.rag_answers(id),
  -- 'processing': worker bir satırı işlemeye başladığını burada işaretliyor (atomic
  -- claim, iki eşzamanlı worker tetiklemesi aynı satırı iki kez işlemesin diye).
  -- 'failed': Gemini hata verdiyse. attempts 3'e ulaşana kadar tekrar 'queued'e
  -- dönüp bir sonraki çalıştırmada tekrar denenir (geçici bir hata olabilir); 3.
  -- denemeden sonra kalıcı 'failed' kalır — öğrenci kendi akışında bunu görüp
  -- isterse yeniden sorabilir, worker bir daha denemez.
  status text not null default 'queued' check (status = any (array['queued', 'processing', 'failed'])),
  attempts smallint not null default 0,
  error text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_rag_question_queue_status_created on public.rag_question_queue(status, created_at);
create index if not exists idx_rag_question_queue_student on public.rag_question_queue(student_id);

alter table public.rag_question_queue enable row level security;

-- Worker service role ile çalıştığı için RLS'e tabi değil; bu politika sadece
-- öğrencinin kendi "cevap bekleniyor" durumunu görebilmesi için (bkz.
-- /api/rag/unit-feed) — defense-in-depth, route zaten service role + student_id
-- filtresiyle çalışıyor.
drop policy if exists "rag_question_queue_own_read" on public.rag_question_queue;
create policy "rag_question_queue_own_read" on public.rag_question_queue
  for select using (auth.uid() = student_id);
