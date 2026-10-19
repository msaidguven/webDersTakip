-- Haftalık önbellek yenilemesinin (pg_cron → /api/cron/weekly-cache-refresh) her başarılı çalışmasının kaydı.
-- Neden: pg_cron yalnızca HTTP isteğinin gönderildiğini bilir; sitenin 200 dönüp dönmediğini bilmez
-- (net._http_response birkaç saat sonra silinir). Rota başarılı olunca bu tabloya satır yazar; pazartesi
-- sonrası satır yoksa çağrı rotaya ulaşmamış demektir (örn. eski sürüm, 404).
-- Yalnızca service_role yazar/okur; istemci erişimi yok (RLS açık, policy yok).

create table if not exists public.weekly_cache_refresh_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now()
);

alter table public.weekly_cache_refresh_runs enable row level security;
revoke all on public.weekly_cache_refresh_runs from public, anon, authenticated;
grant select, insert on public.weekly_cache_refresh_runs to service_role;
