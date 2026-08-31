-- Gemini'nin cevapları tutarlı hâle geldikten sonra (bkz. gemini.ts'teki prompt/temperature
-- düzeltmeleri), admin onayını beklemeden doğrudan yayınlamaya karar verildi. Bunun yerine
-- öğrenciye "bu cevap yapay zeka tarafından üretildi, hata içerebilir" uyarısı gösterilecek
-- ve öğrenci hatalı/eksik bulduğu cevapları bildirebilecek — bu tablo o bildirimleri tutar.

create table if not exists public.rag_answer_reports (
  id bigint generated always as identity primary key,
  rag_answer_id bigint not null references public.rag_answers(id) on delete cascade,
  student_id uuid references public.profiles(id),
  reason text,
  status text not null default 'open' check (status = any (array['open', 'resolved'])),
  created_at timestamp with time zone not null default now(),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamp with time zone
);

create index if not exists idx_rag_answer_reports_answer_id on public.rag_answer_reports(rag_answer_id);
create index if not exists idx_rag_answer_reports_status on public.rag_answer_reports(status);

-- Sadece API route'lar (service role) yazıp okuyor; öğrenci raporu /api/rag/report üzerinden
-- ekliyor, admin panel /api/admin/rag/reports üzerinden okuyor — public policy gerekmiyor.
alter table public.rag_answer_reports enable row level security;
