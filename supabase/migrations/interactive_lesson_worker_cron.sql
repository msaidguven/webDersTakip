-- Etkileşimli ders üretimi sıklığı (kullanıcı kararı 2026-11-01): ders her çalışmada tek alt konu ilerlediği için
-- Soru AI 2'nin (secondary) saatlik :13 işine ek olarak :33 ve :53'te YALNIZ etkileşimli ders işi çalışır
-- (task = interactive_lesson: iş yoksa soru partisine geçmez). Böylece ders işi saatte 3 adım ilerler; ders işi
-- bitince bu anahtarla saatte yine tek soru partisi yapılır (:13), kota fazladan harcanmaz.
-- ÖNCE KODU DEPLOY EDİN (route'un "task" alanını tanıması gerekir), sonra bu dosyayı çalıştırın.
-- Kapatmak için: select cron.unschedule('interactive-lesson-worker-extra');
select cron.schedule(
  'interactive-lesson-worker-extra',
  '33,53 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/generate-practice-question',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{"worker":"secondary","task":"interactive_lesson"}'::jsonb,
    timeout_milliseconds := 360000
  );
  $$
);
