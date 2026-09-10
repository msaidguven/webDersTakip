-- ai-question-draft-worker job'u pg_cron_workers.sql'de saatlik ('0 * * * *', 24/gün)
-- tanımlanmıştı ama canlıda GERÇEKTE 10 dakikada bir çalışıyordu (144/gün) — muhtemelen
-- daha önce bir hata ayıklama sırasında Supabase SQL Editor'den elle yeniden zamanlanmış
-- ve geri alınmamış (drift). Bu worker'ın kullandığı GEMINI_API_KEY_QUESTIONS ayrı bir
-- Google Cloud projesinde olsa bile free-tier günlük kota (proje+model başına 20/gün)
-- 144 çalıştırmayı asla karşılayamaz — gün içinde birkaç saat sonra yine 429 başlar
-- (2026-09-10 kullanıcı bildirimi). cron.schedule aynı job adıyla çağrılınca var olan
-- job'u GÜNCELLER (yeni bir tane eklemez) — burada tasarlandığı gibi saatlik'e (24/gün)
-- geri çekiliyor. Not: 24, 20/gün free-tier kotasını hafifçe aşıyor — admin panelinden
-- elle tetiklenen üretimler de (aynı key'i paylaşan
-- app/api/admin/topic-sections/classical-questions/generate) sayılırsa günün son
-- saatlerinde ara sıra 429 görülebilir, bilerek kabul edildi (kullanıcı tercihi,
-- 2026-09-10) — 144/gün'e kıyasla artık marjinal bir fark.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.
select cron.schedule(
  'ai-question-draft-worker',
  '0 * * * *',
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
