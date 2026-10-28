-- Öğretmen e-posta doğrulaması (2026-10-28, kullanıcı kararı). Kayıtta e-posta onayı yok (admin.createUser
-- email_confirm:true, bkz. api/auth/register); öğretmen için ayrı doğrulama: bağlantı Resend ile gider, admin
-- onayı ("Onaylı öğretmen" rozeti) e-posta doğrulanmadan verilemez. Araçlar doğrulamasız da açık.
--   email_verified_at       — doğrulandığı an (Google ile girişte Google'ın doğruladığı adres sayılır)
--   email_verify_token_hash — gönderilen bağlantının sha256'sı (bağlantının kendisi saklanmaz), 24 saat geçerli
--   email_verify_sent_at    — son gönderim (yeniden gönderme sınırı + geçerlilik süresi)
-- profiles'ta kullanıcı bazlı SELECT politikası yok; sütunlar yalnız servis rolüyle okunur.
alter table public.profiles add column if not exists email_verified_at timestamptz;
alter table public.profiles add column if not exists email_verify_token_hash text;
alter table public.profiles add column if not exists email_verify_sent_at timestamptz;
create unique index if not exists profiles_email_verify_token_hash_key on public.profiles (email_verify_token_hash) where email_verify_token_hash is not null;

-- Mevcut onaylı öğretmenler ve Google ile açılmış öğretmen hesapları doğrulanmış sayılır.
update public.profiles set email_verified_at = now()
where role = 'teacher' and email_verified_at is null and (is_verified or signup_method = 'google');
