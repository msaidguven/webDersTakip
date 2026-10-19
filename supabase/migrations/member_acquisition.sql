-- Üye kayıt kaynağı ("ilk temas"): kayıt yöntemi, ilk açılan sayfa, geldiği yer, cihaz, UTM.
-- Tarayıcı ilk ziyarette dt_acq çerezine yazar (AcquisitionCapture); kayıt route'u ve OAuth
-- callback'i çerezi okuyup buraya tek seferlik yazar. Bu migration öncesi üyelerde alanlar boştur
-- (geriye dönük veri yok).

alter table public.profiles
  add column if not exists signup_method text check (signup_method in ('email', 'google')),
  add column if not exists acquisition jsonb check (acquisition is null or jsonb_typeof(acquisition) = 'object');

-- Kullanıcı kendi profilini güncelleyebildiği için (RLS) bu iki alanı yalnızca service-role
-- değiştirebilir; aynı desen bkz. profiles_ban_metadata.sql.
create or replace function public.prevent_client_acquisition_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' then
    if new.signup_method is distinct from old.signup_method
       or new.acquisition is distinct from old.acquisition
    then
      raise exception 'Kayıt kaynağı yalnızca sunucu tarafından değiştirilebilir';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_acquisition_guard on public.profiles;
create trigger profiles_acquisition_guard
  before update on public.profiles
  for each row
  execute function public.prevent_client_acquisition_update();
