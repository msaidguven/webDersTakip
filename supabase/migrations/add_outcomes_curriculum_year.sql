-- Kazanımlara opsiyonel bir "müfredat yılı" etiketi (ör. "2026-2027") ekliyoruz. Kalıcı bir
-- versiyonlama sistemi değil — ileride müfredat değiştiğinde eski/yeni kazanımları ayırt
-- edip karşılaştırmak (ve içerik/soruları yeniye taşıyıp eskiyi güvenle silmek) için bir
-- geçiş aracı planlanıyor; şimdilik sadece bu alan açılıyor, mantık/arayüz henüz yok.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

alter table public.outcomes
  add column if not exists curriculum_year text;
