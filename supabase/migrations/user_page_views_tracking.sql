-- Giriş yapmış kullanıcıların ziyaret ettiği sayfalar + "son görülme" (kullanıcı isteği,
-- 2026-09-26: admin üye düzenleme ekranında kullanıcının en son hangi sayfalara girdiğini
-- görmek). auth.users.last_sign_in_at yalnızca gerçek girişte güncellenir; oturumu açık
-- kalıp her gün gelen biri haftalarca eski tarihle görünür — last_seen_at bunu kapatır.
-- Anonim ziyaretçiler kaydedilmez (onlar için GA yeterli).

alter table public.profiles add column if not exists last_seen_at timestamptz;

create table if not exists public.user_page_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null check (char_length(path) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists user_page_views_user_created_idx on public.user_page_views (user_id, created_at desc);
create index if not exists user_page_views_created_idx on public.user_page_views (created_at);

-- RLS açık, policy YOK: client doğrudan okuyamaz/yazamaz. Yazma yalnızca aşağıdaki RPC
-- (auth.uid() ile), okuma yalnızca admin API'si (service role) üzerinden.
alter table public.user_page_views enable row level security;

create or replace function public.track_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_path is null or p_path !~ '^/' or char_length(p_path) > 500 then
    return;
  end if;

  -- Aynı sayfanın 30 sn içinde tekrar kaydı (yenileme, geri/ileri) gürültü — atla.
  if not exists (
    select 1 from public.user_page_views
    where user_id = v_uid and path = p_path and created_at > now() - interval '30 seconds'
  ) then
    insert into public.user_page_views (user_id, path) values (v_uid, p_path);
  end if;

  -- profiles satırını her sayfada yazmamak için 1 dk'dan eskiyse güncelle.
  update public.profiles
     set last_seen_at = now()
   where id = v_uid
     and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
end;
$$;

revoke all on function public.track_page_view(text) from public, anon;
grant execute on function public.track_page_view(text) to authenticated;

-- 90 günden eski kayıtları her gece sil — tablo şişmesin, kişisel veri gereğinden uzun
-- tutulmasın (KVKK). cron.schedule aynı isimle tekrar çağrılınca job'u günceller.
select cron.schedule(
  'user_page_views_cleanup',
  '17 3 * * *',
  $$delete from public.user_page_views where created_at < now() - interval '90 days'$$
);
