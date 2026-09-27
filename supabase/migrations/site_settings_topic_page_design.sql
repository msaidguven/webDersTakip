-- Site genelinde admin'in kod değişikliği olmadan değiştirebildiği ayarlar (kullanıcı isteği,
-- 2026-09-27: konu sayfasında v2'yi seçince herkes v2'yi görsün). İlk anahtar:
-- topic_page_design = "v1" | "v2" (bkz. app/src/lib/topicPageDesign.ts).
--
-- Okuma herkese açık (ISR sayfaları anon client'la render ediliyor; bu tabloda gizli bilgi
-- tutulmaz). Yazma yalnız service role — admin API'si requireAdmin ile yetkilendirip yazar.
create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]{1,64}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.site_settings from anon, authenticated;

insert into public.site_settings (key, value)
values ('topic_page_design', '"v1"'::jsonb)
on conflict (key) do nothing;
