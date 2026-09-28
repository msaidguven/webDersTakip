-- İlerlemem sayfası (yol haritası 4c/4d, 2026-09-28): öğrencinin gün gün çözdüğü soru ve
-- doğru sayısı, Türkiye takvim gününe göre. "Son 7 gün" özeti, seri / en uzun seri ve
-- "Son 4 hafta" tablosu hepsi bu tek listeden istemcide hesaplanır.
--
-- Neden RPC: ham satırları istemciye çekmek PostgREST'in 1000 satır sınırına takılıyor
-- (aktif bir öğrencinin toplamı yanlış çıkar) ve gün sınırını tarayıcının saat dilimine
-- bırakıyordu. Burada gruplama sunucuda, gün = Europe/Istanbul.
--
-- SECURITY INVOKER + auth.uid(): test_session_answers'ın mevcut RLS'i (sadece kendi
-- satırları) aynen geçerli; başka kullanıcının verisi dönemez. Satır sayısı = öğrencinin
-- aktif olduğu gün sayısı (yılda en fazla 366).

create or replace function public.get_my_daily_activity()
returns table (day date, answered integer, correct integer)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (a.created_at at time zone 'Europe/Istanbul')::date as day,
    count(*)::integer as answered,
    count(*) filter (where a.is_correct)::integer as correct
  from public.test_session_answers a
  where a.user_id = auth.uid()
  group by 1
  order by 1;
$$;

revoke all on function public.get_my_daily_activity() from public, anon;
grant execute on function public.get_my_daily_activity() to authenticated;
