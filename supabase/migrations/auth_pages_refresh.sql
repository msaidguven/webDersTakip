-- Giriş/kayıt sayfalarının yenilenmesi (2026-10-03).
--
-- ÖNCE bu dosyayı çalıştırın, SONRA kodu deploy edin — kayıt API'si privacy_accepted_at'e
-- yazıyor ve şifre sıfırlama API'si aşağıdaki fonksiyonu çağırıyor.

-- 1) Kayıt formundaki Gizlilik Politikası onayı (KVKK): onayın ne zaman verildiği kaydedilir;
--    app/api/auth/register onay olmadan hesap açmaz. Eski hesaplarda ve Google ile açılan
--    hesaplarda NULL kalır (Google düğmesinin altındaki bilgilendirme metni geçerli).
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;

-- 2) Şifre sıfırlama isteklerine IP başına sınır (app/api/auth/password-reset). Supabase'in
--    e-posta sınırı TÜM site için saatte 30 — tek kişi formu kötüye kullanırsa herkesin sıfırlama
--    e-postası durur. Aynı IP'den 15 dakikada en fazla 3 istek.
alter table public.auth_attempts drop constraint if exists auth_attempts_kind_check;
alter table public.auth_attempts
  add constraint auth_attempts_kind_check check (kind = any (array['register'::text, 'login'::text, 'password_reset'::text]));

create or replace function public.web_check_password_reset_limit(p_ip text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_third timestamptz;
begin
  select created_at into v_third
  from public.auth_attempts
  where ip = p_ip and kind = 'password_reset' and created_at > now() - interval '15 minutes'
  order by created_at desc
  offset 2 limit 1;

  if v_third is not null then
    return query select false, greatest(1, ceil(extract(epoch from (v_third + interval '15 minutes' - now())))::integer);
    return;
  end if;
  return query select true, 0;
end;
$$;

revoke all on function public.web_check_password_reset_limit(text) from public, anon, authenticated;
grant execute on function public.web_check_password_reset_limit(text) to service_role;
