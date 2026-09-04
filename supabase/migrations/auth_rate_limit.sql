-- Kayıt/giriş uç noktalarının (app/api/auth/register, app/api/auth/login) IP başına
-- brute-force denemelerini sınırlaması için: aynı IP'den 5 dakika içinde 5+ başarısız
-- deneme olursa, o IP'yi son başarısız denemeden itibaren 15 dakika engelle.
create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  kind text not null check (kind = any (array['register'::text, 'login'::text])),
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_attempts_ip_created_idx
  on public.auth_attempts (ip, created_at desc);

-- IP engelli mi diye kontrol eder. Ayrı bir "locked_until" tablosu tutmak yerine, son
-- 5 dakika içindeki 5. (en eski) başarısız denemenin zamanını bulup ondan +15 dakikayı
-- engel bitişi olarak hesaplar — engel süresi geçtikçe otomatik olarak kalkar.
create or replace function public.web_check_auth_rate_limit(p_ip text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fifth_failure timestamptz;
  v_blocked_until timestamptz;
begin
  select created_at into v_fifth_failure
  from public.auth_attempts
  where ip = p_ip and success = false
  order by created_at desc
  offset 4 limit 1;

  if v_fifth_failure is not null and v_fifth_failure > now() - interval '5 minutes' then
    v_blocked_until := v_fifth_failure + interval '15 minutes';
    if now() < v_blocked_until then
      return query select false, greatest(1, ceil(extract(epoch from (v_blocked_until - now())))::integer);
      return;
    end if;
  end if;

  return query select true, 0;
end;
$$;

create or replace function public.web_record_auth_attempt(p_ip text, p_kind text, p_success boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.auth_attempts (ip, kind, success) values (p_ip, p_kind, p_success);
$$;

grant execute on function public.web_check_auth_rate_limit(text) to anon, authenticated, service_role;
grant execute on function public.web_record_auth_attempt(text, text, boolean) to anon, authenticated, service_role;
