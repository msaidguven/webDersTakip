-- Kullanıcı adı olmayan mevcut üyelere e-postalarının @ öncesinden ad ver (kullanıcı isteği,
-- 2026-09-26). Yeni Google kayıtlarıyla aynı kural: make_unique_username (bkz.
-- username_auto_and_profile_prompt.sql).
--
-- Tek UPDATE yerine satır satır döngü: aynı komut içinde yazılan satırları
-- make_unique_username göremez, iki üye aynı tabandan (ör. ali@gmail, ali@hotmail) aynı adı
-- alıp unique ihlaline düşerdi. Her iterasyon ayrı komut olduğu için bir öncekini görür.
do $$
declare
  r record;
begin
  for r in
    select p.id, u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.username is null or p.username = ''
    order by u.created_at
  loop
    update public.profiles
       set username = public.make_unique_username(r.email)
     where id = r.id;
  end loop;
end;
$$;
