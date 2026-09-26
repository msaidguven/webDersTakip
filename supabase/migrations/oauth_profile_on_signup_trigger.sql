-- Google ile gelen 7 kullanıcının auth.users satırı vardı ama profiles satırı yoktu (bulgu
-- 2026-09-26): app/auth/callback profili KULLANICININ oturumuyla insert ediyordu ve bu
-- insert RLS'e takılıp /login?error=profile_creation_failed'e düşüyordu. Sonuç: anasayfa
-- üye sayacı (profiles'ı sayar) 31 yerine 24 gösteriyordu, bu kişiler admin üye
-- listesinde de görünmüyordu ve uygulamayı kullanamıyorlardı.
--
-- Profil artık auth.users'a satır eklendiği AN veritabanında oluşuyor — callback'in
-- başarısına, RLS'e veya ağ hatasına bağlı değil. SADECE OAuth sağlayıcıları: e-posta
-- kaydı (app/api/auth/register) profili rol/sınıf bilgisiyle kendisi insert ediyor,
-- burada da oluşturulursa o insert duplicate key ile patlar.
create or replace function public.handle_new_oauth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then
    return new;
  end if;

  insert into public.profiles (id, full_name, avatar_url, role, onboarding_completed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'student',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_oauth_user() from public, anon, authenticated;

drop trigger if exists on_auth_oauth_user_created on auth.users;
create trigger on_auth_oauth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_oauth_user();

-- Geriye dönük: profili eksik kalan mevcut kullanıcılar. onboarding_completed=false →
-- bir sonraki girişlerinde /profil'e yönlenip öğrenci/öğretmen + sınıf seçecekler.
insert into public.profiles (id, full_name, avatar_url, role, onboarding_completed)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  'student',
  false
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
