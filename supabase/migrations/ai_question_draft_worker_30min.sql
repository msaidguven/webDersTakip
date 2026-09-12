-- ai-question-draft-worker job'u saatlik ('0 * * * *', 24/gün) çalışıyordu — kullanıcının
-- 2026-09-12 talebiyle şimdilik 30 dakikada bire (48/gün) çıkarıldı. cron.schedule aynı job
-- adıyla çağrılınca var olan job'u GÜNCELLER (yeni bir tane eklemez).
--
-- NOT: Bu worker'ın kullandığı GEMINI_API_KEY_QUESTIONS free-tier günlük kotası (proje+model
-- başına 20/gün) zaten saatlik (24/gün) tempoyla hafifçe aşılıyordu (bkz.
-- fix_ai_question_draft_worker_schedule.sql) — 48/gün bunun iki katından fazla, bu yüzden
-- günün ilk birkaç saatinden sonra 429 (kota doldu) hataları görülmesi beklenir; worker bu
-- durumda o çalıştırmayı atlar, hata birikmez, sadece o gün için üretim erken durur.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın. cron.schedule (aynı isimle
-- command'ı yeniden dollar-quoted olarak vermek) yerine cron.alter_job kullanılıyor —
-- sadece schedule'ı değiştirir, mevcut command'a dokunmaz; SQL editor'de $$ ... $$
-- bloğunun kopyala-yapıştırda bozulma riskini de ortadan kaldırır (kullanıcının
-- 2026-09-12 karşılaştığı "syntax error at or near )" sorunu).
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'ai-question-draft-worker'),
  schedule := '*/30 * * * *'
);
