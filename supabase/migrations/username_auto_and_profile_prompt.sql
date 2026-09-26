-- Yeni üyelere kullanıcı adı + "profilini güncelle" uyarısı (kullanıcı isteği, 2026-09-26):
--   * e-posta ile kayıt: kullanıcı adını formda kendisi seçer (app/api/auth/register)
--   * Google ile kayıt: e-postanın @ öncesinden otomatik, çakışırsa sonuna sayı eklenir
--   * yeni üyeye bir kez "profilini güncelle" uyarısı (profile_prompt_pending)
-- Kural app/src/lib/username.ts'teki USERNAME_PATTERN ile birebir aynı.

-- DEFAULT false: mevcut üyeler uyarıyı görmez, sadece bundan sonraki kayıtlar true başlar.
alter table public.profiles add column if not exists profile_prompt_pending boolean not null default false;

-- NOT VALID: mevcut satırları taramaz (hepsi zaten uyuyor ama migration bir satır yüzünden
-- patlamasın), yeni insert/update'lerde zorunlu.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format check (
  username is null
  or (char_length(username) between 3 and 30 and username ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$')
) not valid;

-- Serbest bir metinden (e-posta, ad) kurala uyan ve BOŞTA olan bir kullanıcı adı üretir.
create or replace function public.make_unique_username(p_seed text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix text;
  v_n int := 1;
begin
  v_base := lower(split_part(coalesce(p_seed, ''), '@', 1));
  v_base := translate(v_base, 'çğıöşüâîû', 'cgiosuaiu');
  v_base := regexp_replace(v_base, '[^a-z0-9._]', '', 'g');
  v_base := regexp_replace(v_base, '\.{2,}', '.', 'g');
  v_base := trim(both '.' from left(trim(both '.' from v_base), 30));
  if char_length(v_base) < 3 then
    v_base := 'uye';
  end if;

  v_candidate := v_base;
  while exists (select 1 from public.profiles where username = v_candidate) loop
    v_n := v_n + 1;
    -- İlk denemeler okunaklı (ahmet2, ahmet3...), sonra rastgele — kalabalık bir tabanda
    -- sonsuz sayıya kadar sıralı denemesin.
    v_suffix := case when v_n <= 20 then v_n::text else (1000 + floor(random() * 9000))::int::text end;
    v_candidate := trim(both '.' from left(v_base, 30 - char_length(v_suffix))) || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

revoke all on function public.make_unique_username(text) from public, anon, authenticated;
grant execute on function public.make_unique_username(text) to service_role;

-- oauth_profile_on_signup_trigger.sql'deki fonksiyonun yerine geçer: artık kullanıcı adı ve
-- uyarı bayrağı da set ediliyor. Aynı anda iki kayıt aynı adı kaparsa unique_violation'da
-- yeni bir ad üretip tekrar dener — trigger patlarsa auth.users insert'i (yani Google
-- girişi) da düşerdi.
create or replace function public.handle_new_oauth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt int := 0;
begin
  if coalesce(new.raw_app_meta_data->>'provider', 'email') = 'email' then
    return new;
  end if;

  loop
    begin
      insert into public.profiles (id, full_name, avatar_url, username, role, onboarding_completed, profile_prompt_pending)
      values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
        coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
        public.make_unique_username(new.email),
        'student',
        false,
        true
      )
      on conflict (id) do nothing;
      exit;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        -- Son çare: adsız oluştur, kullanıcı /profil'den seçer. Girişi asla engelleme.
        insert into public.profiles (id, full_name, avatar_url, role, onboarding_completed, profile_prompt_pending)
        values (
          new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
          'student',
          false,
          true
        )
        on conflict (id) do nothing;
        exit;
      end if;
    end;
  end loop;

  return new;
end;
$$;

revoke all on function public.handle_new_oauth_user() from public, anon, authenticated;
