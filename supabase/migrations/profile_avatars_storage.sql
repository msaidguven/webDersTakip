-- Profil resmi yükleme "hata alıyorum" şikayeti (2026-09-12): 'profiles' storage
-- bucket'ı hiçbir migration'da oluşturulmamış/politikalandırılmamış — muhtemelen
-- panelden manuel eklenmişti ama storage.objects üzerinde authenticated
-- kullanıcıların KENDİ avatarlarını insert/update edebilmesini sağlayan bir RLS
-- policy hiç yoktu, bu yüzden yükleme RLS'e takılıp hata veriyordu.
--
-- Aynı raporun ikinci isteği: "biri yüklendikten sonra biri daha yükleyeceksem
-- önceki silinsin". Dosya adı önceden `{user_id}-{timestamp}.{ext}` idi — her
-- yeni yüklemede eskisi silinmeden yeni bir dosya birikiyordu (storage'da
-- sonsuza dek büyüyen çöp). Çözüm: dosya adı artık SABİT `avatars/{user_id}.{ext}`
-- (bkz. app/profil/ProfilClient.tsx) — hem benzersiz (auth.uid() zaten unique,
-- kullanıcı adı/nickname'den daha iyi çünkü nickname boş/değişken olabilir) hem
-- de re-upload'ta upsert ile aynı yolun üzerine yazılıyor; farklı bir uzantıyla
-- yeniden yüklenirse eski uzantılı dosya da kod tarafında explicit siliniyor.
-- ProfilClient.tsx artık her avatarı yüklemeden ÖNCE tarayıcıda WebP'ye çevirip
-- 512px'e küçültüyor (kullanıcı isteği, 2026-09-12) — bucket'ı da SADECE bu formatı
-- kabul edecek şekilde kısıtlıyoruz, başka bir mime type sunucuya hiç ulaşmasın.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profiles', 'profiles', true, 2097152, array['image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/webp'];

-- Her kullanıcı SADECE kendi id'siyle başlayan avatar dosyasını yükleyebilir/
-- güncelleyebilir/silebilir — path'i "avatars/<kendi auth.uid()>.<uzantı>" olacak
-- şekilde sınırlıyoruz, başka bir kullanıcının avatarının üzerine yazılamaz.
drop policy if exists "profiles_avatar_owner_write" on storage.objects;
create policy "profiles_avatar_owner_write" on storage.objects
  for insert
  with check (
    bucket_id = 'profiles'
    and name like 'avatars/' || auth.uid()::text || '.%'
  );

drop policy if exists "profiles_avatar_owner_update" on storage.objects;
create policy "profiles_avatar_owner_update" on storage.objects
  for update
  using (
    bucket_id = 'profiles'
    and name like 'avatars/' || auth.uid()::text || '.%'
  );

drop policy if exists "profiles_avatar_owner_delete" on storage.objects;
create policy "profiles_avatar_owner_delete" on storage.objects
  for delete
  using (
    bucket_id = 'profiles'
    and name like 'avatars/' || auth.uid()::text || '.%'
  );

-- Bucket zaten public (avatar URL'leri her yerde, ör. yorumlarda gösteriliyor) ama
-- storage.objects RLS açıkken public bucket'ta bile SELECT policy'si gerekiyor.
drop policy if exists "profiles_avatar_public_read" on storage.objects;
create policy "profiles_avatar_public_read" on storage.objects
  for select
  using (bucket_id = 'profiles');
