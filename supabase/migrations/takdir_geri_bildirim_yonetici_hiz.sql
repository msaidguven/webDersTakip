-- Hata bildirimleri: yalnızca yönetici okur (admin listesi sayfası için).
-- Tekrar çalıştırılabilir: policy'ler önce düşürülüp yeniden kuruluyor.
drop policy if exists "yonetici geri bildirimleri okur" on public.takdir_hesaplama_geri_bildirim;
create policy "yonetici geri bildirimleri okur" on public.takdir_hesaplama_geri_bildirim
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Spam koruması: tüm anonim bildirimler toplamda son 10 dakikada en fazla 20;
-- giriş yapmış bir kullanıcı son 24 saatte en fazla 5 bildirim gönderebilir.
create or replace function public.takdir_geri_bildirim_hiz_ok(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.takdir_hesaplama_geri_bildirim
       where user_id is null and created_at > now() - interval '10 minutes') < 20
    and (
      p_user_id is null
      or (select count(*) from public.takdir_hesaplama_geri_bildirim
            where user_id = p_user_id and created_at > now() - interval '24 hours') < 5
    );
$$;

drop policy if exists "geri bildirim ekleme" on public.takdir_hesaplama_geri_bildirim;

create policy "geri bildirim ekleme" on public.takdir_hesaplama_geri_bildirim
  for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and public.takdir_geri_bildirim_hiz_ok(user_id)
  );
