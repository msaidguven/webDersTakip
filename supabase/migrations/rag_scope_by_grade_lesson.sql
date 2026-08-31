-- add_rag_document_qa.sql, RAG kapsamını topic_id (konu) bazında kurmuştu.
-- Gerçekte ders notu PDF'leri konuya göre değil, sınıf+ders (kitap) bazında
-- ayrılmış (ör. "5. Sınıf Sosyal Bilgiler 1" ve "... 2" aynı dersin/sınıfın iki
-- cildi). Bir öğrenci "5. sınıf sosyal"dan soru sorduğunda arama SADECE o
-- dersin/sınıfın kitaplarında yapılsın, başka sınıf/dersin notlarına hiç
-- karışmasın diye kapsamı grade_id + lesson_id'ye taşıyoruz. Tablolar henüz boş
-- olduğu için veri taşımaya gerek yok.

alter table public.rag_documents drop column if exists topic_id;
alter table public.rag_documents
  add column grade_id bigint not null references public.grades(id),
  add column lesson_id bigint not null references public.lessons(id);

alter table public.rag_document_chunks drop column if exists topic_id;
alter table public.rag_document_chunks
  add column grade_id bigint not null references public.grades(id),
  add column lesson_id bigint not null references public.lessons(id);

alter table public.rag_answers drop column if exists topic_id;
alter table public.rag_answers
  add column grade_id bigint not null references public.grades(id),
  add column lesson_id bigint not null references public.lessons(id);

drop index if exists idx_rag_documents_topic_id;
create index if not exists idx_rag_documents_grade_lesson on public.rag_documents(grade_id, lesson_id);

drop index if exists idx_rag_chunks_topic_id;
create index if not exists idx_rag_chunks_grade_lesson on public.rag_document_chunks(grade_id, lesson_id);

drop index if exists idx_rag_answers_topic_id;
create index if not exists idx_rag_answers_grade_lesson on public.rag_answers(grade_id, lesson_id);

-- match_rag_chunks artık bir konu değil, bir sınıf+ders (kitap) kapsamında arar.
drop function if exists public.match_rag_chunks(vector, bigint, int);
create or replace function public.match_rag_chunks(
  query_embedding vector(768),
  match_grade_id bigint,
  match_lesson_id bigint,
  match_count int default 5
)
returns table (
  id bigint,
  document_id bigint,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.rag_document_chunks c
  where c.grade_id = match_grade_id and c.lesson_id = match_lesson_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
