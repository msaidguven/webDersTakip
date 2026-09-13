-- "RAG Ünite Sentezi (Tekrar Kontrolü)" ünite yanındaki butonun yeşil tikini göstermek
-- için: bu ünite için en az bir kez başarıyla düzenleme uygulandığında (bkz.
-- unit-source-dedup-apply/route.ts) bu alan set edilir.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.units
  add column if not exists rag_dedup_checked_at timestamptz;
