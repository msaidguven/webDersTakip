-- Var olan ban mekanizması (auth.users.banned_until, bkz. app/api/admin/manage/members
-- route.ts) yeni sign-in/refresh isteklerini zaten engelliyor. Bu migration onun yerine
-- geçmiyor — sadece iki şey ekliyor:
--   1) Denetim alanları (kim, ne zaman, neden banladı) — auth.users'ta bu bilgi yok.
--   2) is_banned mirror kolonu — middleware her korumalı sayfa isteğinde bunu okuyup
--      hâlâ geçerli olan access token'la gezinen banlı kullanıcıyı anında dışarı atabilsin
--      diye (auth.users sorgulamak admin/service-role gerektirir, middleware'de İstenmez).
alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text,
  add column if not exists banned_by uuid references public.profiles(id);

-- Bu dört kolonu yalnızca service-role (admin API route'ları) değiştirebilir — RLS
-- kullanıcının kendi profilini güncelleyebildiği bir policy'ye sahip olsa bile, bir
-- kullanıcı kendini "unban" edemez veya banned_by/banned_reason ile oynayamaz.
create or replace function public.prevent_client_ban_column_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.is_banned is distinct from old.is_banned
       or new.banned_at is distinct from old.banned_at
       or new.banned_reason is distinct from old.banned_reason
       or new.banned_by is distinct from old.banned_by
    then
      raise exception 'Bu alanlar yalnızca sunucu tarafından değiştirilebilir';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_ban_columns_guard on public.profiles;
create trigger profiles_ban_columns_guard
  before update on public.profiles
  for each row
  execute function public.prevent_client_ban_column_update();
