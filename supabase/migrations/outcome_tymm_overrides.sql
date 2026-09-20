-- TYMM karşılaştırmasında metin birebir eşleşmediği için "farklı" görünen ama admin'in
-- gözden geçirip doğru kabul ettiği kazanımlar — kullanıcının 2026-09-20 isteği: "kontrol
-- ettim doğru diye bi buton olsa ... bundan sonra tekrar kontrol ettiğimde otomatik olsun,
-- ama zorla doğru kabul ettirildi diye küçük bir not verilsin". Bir outcome'un aynı anda
-- sadece bir "kabul edilmiş" TYMM metni olabilir (primary key = outcome_id) — TYMM metni
-- ileride gerçekten değişirse admin'in tekrar gözden geçirmesi gerekir, o yüzden hangi
-- TYMM metnine karşı onaylandığı da saklanıyor.
create table if not exists public.outcome_tymm_overrides (
  outcome_id bigint primary key references public.outcomes(id) on delete cascade,
  tymm_text text not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
