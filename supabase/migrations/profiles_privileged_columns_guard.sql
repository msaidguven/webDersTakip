-- GÜVENLİK (2026-11-15): profiles'ta "kendi satırını güncelle" RLS politikası + authenticated rolünün
-- tüm sütunlarda UPDATE yetkisi vardı; mevcut tetikleyiciler yalnız ban ve kayıt kaynağı sütunlarını
-- koruyordu. Yani giriş yapmış herhangi bir üye tarayıcıdan kendi satırında role = 'admin' ya da
-- is_verified = true yazabiliyordu. Bu sütunları yazan bütün uygulama kodu servis rolüyle çalışıyor
-- (api/profile/update, api/admin/*, api/auth/*, lib/emailVerification.ts) — istemci yazımı kapatılıyor.
create or replace function public.prevent_client_privileged_profile_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    if tg_op = 'INSERT' then
      if new.role = 'admin'
         or new.is_verified is true
         or new.is_test_account is true
         or new.email_verified_at is not null
      then
        raise exception 'Bu alanlar yalnızca sunucu tarafından değiştirilebilir';
      end if;
    elsif new.role is distinct from old.role
       or new.is_verified is distinct from old.is_verified
       or new.is_test_account is distinct from old.is_test_account
       or new.email_verified_at is distinct from old.email_verified_at
       or new.email_verify_token_hash is distinct from old.email_verify_token_hash
       or new.email_verify_sent_at is distinct from old.email_verify_sent_at
    then
      raise exception 'Bu alanlar yalnızca sunucu tarafından değiştirilebilir';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_privileged_columns_guard on public.profiles;
create trigger profiles_privileged_columns_guard
  before insert or update on public.profiles
  for each row execute function public.prevent_client_privileged_profile_update();
