-- Denetim bekleyen taslaklar (kullanıcı isteği 2026-11-03: "hata olursa boşa gitmesin"): soru partisinde üretim
-- başarılı olup denetim (AI kontrolü) çağrısı hata verirse (kota 429, yoğunluk 503, zaman aşımı…) üretilen taslak
-- eskiden çöpe gidiyor, sonraki çalışma aynı soruları sıfırdan üretiyordu (Gemini günde 20 istek/model). Artık
-- taslak burada saklanır; aynı adım (konu + tur + alt başlık; konu geneli = 0) yeniden geldiğinde üretim atlanıp
-- yalnız denetim yapılır, denetim başarılı olunca kayıt silinir. Kod: app/src/lib/aiQuestionDraftGen.ts.
-- Yazma/okuma yalnız sunucudan (service role); RLS açık, policy yok.
create table if not exists public.ai_question_unreviewed_drafts (
  batch_topic_id bigint not null,
  batch_round integer not null,
  section_key bigint not null,
  questions jsonb not null,
  ai_model text not null,
  created_at timestamptz not null default now(),
  primary key (batch_topic_id, batch_round, section_key)
);
alter table public.ai_question_unreviewed_drafts enable row level security;
revoke all on public.ai_question_unreviewed_drafts from anon, authenticated;
