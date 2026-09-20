-- Konu (topic) altında BİRDEN FAZLA öğrenme çıktısı olabiliyor (TYMM'in kendi yapısı böyle,
-- ör. Matematik 6 "Bir Doğal Sayının Çarpanları ve Katları" konusu hem MAT.6.1.1 hem
-- MAT.6.1.4 öğrenme çıktısını içeriyor) — ama topics.learning_outcome TEK bir metin alanı,
-- bu yüzden birden fazla öğrenme çıktısı tek konuya düşünce ya birleştiriliyor ya da biri
-- diğerinin üstüne yazılıyordu (2026-09-20 kullanıcı bildirimi). Bu tablo konu ile kazanım
-- arasına, öğrenme çıktısını kendi kod+başlığıyla ayrı bir grup olarak ekliyor:
--   konu → topic_learning_outcomes (N adet) → outcomes (her birinin a/b/c kazanımları)
--
-- BİLEREK EKLEME (additive) yapıldı, mevcut hiçbir şeyi bozmuyor: outcomes.topic_id ve
-- topics.learning_outcome kolonlarına dokunulmadı — soru üretimi, RAG, haftalık kazanım
-- gösterimi gibi outcomes'u düz liste olarak okuyan 25+ dosyanın hiçbiri etkilenmiyor.
-- learning_outcome_id NULL olabilir (eski/henüz taşınmamış kayıtlar için) — sadece YENİ
-- TYMM aktarımları bundan sonra bu grubu dolduracak (bkz. importUnit.ts), eski veriler
-- aşama aşama, ünite ünite kontrol edilerek taşınacak.
create table if not exists public.topic_learning_outcomes (
  id bigint generated always as identity primary key,
  topic_id bigint not null references public.topics(id) on delete cascade,
  code text,
  title text not null,
  order_no integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_topic_learning_outcomes_topic_id on public.topic_learning_outcomes(topic_id);

alter table public.outcomes
  add column if not exists learning_outcome_id bigint references public.topic_learning_outcomes(id) on delete set null;

create index if not exists idx_outcomes_learning_outcome_id on public.outcomes(learning_outcome_id);
