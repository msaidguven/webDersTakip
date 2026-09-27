-- Admin ziyaretleri hiç kaydedilmesin + mevcut admin kayıtları silinsin (kullanıcı isteği,
-- 2026-09-26). Kontrol track_page_view içinde — tabloya yazan tek yol bu RPC olduğu için
-- istemciden bağımsız garanti. last_seen_at adminler için de güncellenmeye devam eder.

create or replace function public.track_page_view(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_uid is null or p_path is null or p_path !~ '^/' or char_length(p_path) > 500 then
    return;
  end if;

  select role = 'admin' into v_is_admin from public.profiles where id = v_uid;

  -- Aynı sayfanın 30 sn içinde tekrar kaydı (yenileme, geri/ileri) gürültü — atla.
  if not coalesce(v_is_admin, false) and not exists (
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

-- Mevcut admin kayıtlarını sil (geri alınamaz).
delete from public.user_page_views v
using public.profiles p
where p.id = v.user_id and p.role = 'admin';
