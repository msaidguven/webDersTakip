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
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.
select cron.schedule(
  'ai-question-draft-worker',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
