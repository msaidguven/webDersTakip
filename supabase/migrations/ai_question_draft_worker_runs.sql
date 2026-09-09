-- generate-practice-question artık Supabase pg_cron+pg_net'ten (bkz. pg_cron_workers.sql)
-- tetikleniyor ve net.http_post yanıtı BEKLEMİYOR (fire-and-forget) — yani generated:false
-- dönen bir çalışma (örn. Gemini kota/hata durumu) hiçbir yere yazılmadan kayboluyordu,
-- tek belirti "taslak gelmiyor" oluyordu (kullanıcının 2026-09-09 "20 saatte 1 defa"
-- şikayetiyle aynı görünürlük sorunu). Her çalıştırmayı burada logluyoruz ki admin
-- panelinde (AI Soru Taslakları) art arda başarısızlık/hata sebebi görülebilsin.
create table if not exists public.ai_question_draft_worker_runs (
  id bigint generated always as identity primary key,
  generated boolean not null,
  reason text,
  draft_id bigint references public.ai_question_drafts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_question_draft_worker_runs_created on public.ai_question_draft_worker_runs(created_at desc);

alter table public.ai_question_draft_worker_runs enable row level security;
-- Kasıtlı olarak hiçbir client-erişim policy'si yok — ai_question_drafts ile aynı desen:
-- sadece service role (worker route'u) yazar, sadece admin API route'u (requireAdmin) okur.
