-- RAG (Retrieval-Augmented Generation) altyapısı: konu bazlı ders notu PDF'lerini
-- parçalayıp Gemini embedding'leriyle saklar, öğrenci sorularını bu parçalara
-- dayanarak Gemini ile cevaplar ve cevabı admin onayına düşürür. Hazır bir arama
-- servisi (Vertex AI Search vb.) yerine Supabase pgvector kullanılıyor.

create extension if not exists vector;

-- ders notu PDF'lerinin ham dosyası bu private bucket'ta tutulur; herkese açık
-- URL üretilmez, sadece admin API route'ları (service role) erişir.
insert into storage.buckets (id, name, public)
values ('rag-documents', 'rag-documents', false)
on conflict (id) do nothing;

-- ============================================================
-- rag_documents: yüklenen her ders notu PDF'i için bir kayıt
-- ============================================================
create table if not exists public.rag_documents (
  id bigint generated always as identity primary key,
  topic_id bigint not null references public.topics(id) on delete cascade,
  title text not null,
  file_path text not null,
  page_count integer,
  chunk_count integer not null default 0,
  status text not null default 'processing'
    check (status = any (array['processing', 'ready', 'failed'])),
  error_message text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_rag_documents_topic_id on public.rag_documents(topic_id);

-- ============================================================
-- rag_document_chunks: PDF'ten çıkarılan, embedding'i alınmış metin parçaları
-- Gemini "gemini-embedding-001" modeli 768 boyutlu çıktı verecek şekilde
-- çağrılıyor (bkz. app/src/lib/rag/gemini.ts) — boyut burada da 768 olmalı.
-- ============================================================
create table if not exists public.rag_document_chunks (
  id bigint generated always as identity primary key,
  document_id bigint not null references public.rag_documents(id) on delete cascade,
  topic_id bigint not null references public.topics(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer not null,
  embedding vector(768) not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_rag_chunks_topic_id on public.rag_document_chunks(topic_id);
create index if not exists idx_rag_chunks_document_id on public.rag_document_chunks(document_id);

-- Cosine similarity aramasi icin HNSW indeksi (ivfflat'in aksine onceden
-- "training" verisi gerektirmez, kucuk tablolarda da calisir).
create index if not exists idx_rag_chunks_embedding_hnsw
  on public.rag_document_chunks
  using hnsw (embedding vector_cosine_ops);

-- ============================================================
-- rag_answers: öğrenci soruları + AI'nin ürettiği cevap + onay durumu
-- ============================================================
create table if not exists public.rag_answers (
  id bigint generated always as identity primary key,
  topic_id bigint not null references public.topics(id) on delete cascade,
  student_id uuid references public.profiles(id),
  question text not null,
  answer text not null,
  matched_chunk_ids bigint[] not null default '{}',
  model text not null,
  status text not null default 'pending'
    check (status = any (array['pending', 'published', 'rejected'])),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_rag_answers_topic_id on public.rag_answers(topic_id);
create index if not exists idx_rag_answers_status on public.rag_answers(status);

-- ============================================================
-- RLS: bu tablolara sadece admin API route'ları (service role) yazıyor.
-- Yayınlanmış (published) cevaplar öğrencilere gösterilebileceği için public
-- read açık; pending/rejected durumundaki cevaplar ve ham doküman/parça
-- tabloları service role dışından hiç görünmez.
-- ============================================================
alter table public.rag_documents enable row level security;
alter table public.rag_document_chunks enable row level security;
alter table public.rag_answers enable row level security;

drop policy if exists "rag_answers_published_public_read" on public.rag_answers;
create policy "rag_answers_published_public_read" on public.rag_answers
  for select using (status = 'published');

-- ============================================================
-- match_rag_chunks: bir konu içinde, verilen soru vektörüne en yakın parçaları
-- cosine similarity'e göre döner. Soru-cevap akışı bunu supabase.rpc() ile çağırır.
-- ============================================================
create or replace function public.match_rag_chunks(
  query_embedding vector(768),
  match_topic_id bigint,
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
  where c.topic_id = match_topic_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
