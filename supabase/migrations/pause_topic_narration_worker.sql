-- Konu Sesli Anlatım (topic-narration-worker) geçici olarak durduruldu:
-- Azure TTS kotası tamamen etkileşimli ders v3.1 seslendirmelerine ayrılıyor.
-- Mevcut yayındaki sesli anlatımlar korunur; yalnızca otomatik yeni üretim zamanlayıcısı kapatılır.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'topic-narration-worker') then
    perform cron.unschedule('topic-narration-worker');
  end if;
end;
$$;
