-- 2026-09-14 kullanıcı raporu: bir öğrenci sorusu (kanka modu) 'processing'
-- durumunda sonsuza kadar takılı kaldı, hiç cevaplanmadı, hata da kaydedilmedi.
--
-- KÖK NEDEN: pg_net'in net.http_post çağrısında timeout_milliseconds
-- belirtilmemişti (varsayılan 5000ms). process-queue/generate-practice-question
-- route'ları Gemini'ye soru sorup cevap ürettiği için rutin olarak 5 saniyeden
-- uzun sürüyor — pg_net 5sn'de vazgeçip bağlantıyı kapatınca Vercel bunu
-- "istemci bağlantıyı kesti" sayıp fonksiyonu YARIDA KESİYOR (bkz.
-- net._http_response'ta çok sayıda "Timeout of 5000 ms reached" kaydı). Kod
-- try/catch'ine hiç ulaşamadan öldüğü için satır 'processing'de kalıyor, hata
-- yazılmıyor, bir daha da hiç denenmiyor (worker sorgusu sadece queued/failed
-- seçiyor).
--
-- ÇÖZÜM 1 (bu dosya): pg_net timeout'unu Gemini + 3 ardışık soru için yeterli
-- bir süreye (90sn) çıkarıyoruz. cron.schedule aynı isimle tekrar çağrılınca
-- var olan job'ı GÜNCELLİYOR (yeni job oluşturmuyor).
-- ÇÖZÜM 2: rag_question_queue'ya updated_at eklenip, process-queue route'u
-- artık belirli bir süreden uzun süredir 'processing'de takılı kalan satırları
-- da (öldürülmüş bir önceki denemeden kalma) otomatik geri kuyruğa alıyor —
-- bkz. app/api/rag/process-queue/route.ts.
select cron.schedule(
  'rag-queue-worker',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.derstakip.net/api/rag/process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rag_queue_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $$
);

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
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
  $$
);

alter table public.rag_question_queue add column if not exists updated_at timestamptz not null default now();

-- Şu an 'processing'de takılı kalmış (bu bug yüzünden ölmüş) satırları hemen
-- kurtar — bir sonraki cron tetiklemesinde tekrar denensinler.
update public.rag_question_queue set status = 'queued', updated_at = now() where status = 'processing';
