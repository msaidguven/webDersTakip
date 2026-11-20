-- vercel.json'daki 2 günlük cron işini Supabase pg_cron'a taşır (Firebase App Hosting geçişi).
--   1) srs-reminder-notify: her gün 07:00 UTC (10:00 TR)
--   2) push-reminders: her gün 16:00 UTC (19:00 TR)
--
-- ÇALIŞTIRMADAN ÖNCE:
--   CRON_SECRET değerini Supabase Vault'a 'cron_secret' adıyla ekleyin:
--     select vault.create_secret('<CRON_SECRET>', 'cron_secret', 'pg_cron -> /api/cron/* yetkilendirme');

select cron.unschedule('srs-reminder-notify')
where exists (select 1 from cron.job where jobname = 'srs-reminder-notify');

select cron.schedule(
  'srs-reminder-notify',
  '0 7 * * *',
  $$
  select net.http_get(
    url := 'https://www.derstakip.net/api/cron/srs-reminder-notify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

select cron.unschedule('push-reminders')
where exists (select 1 from cron.job where jobname = 'push-reminders');

select cron.schedule(
  'push-reminders',
  '0 16 * * *',
  $$
  select net.http_get(
    url := 'https://www.derstakip.net/api/cron/push-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
