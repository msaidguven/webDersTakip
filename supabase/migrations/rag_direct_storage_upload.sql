-- Ders notu PDF'leri 100MB+ olabiliyor; Vercel'in serverless function'lara gelen
-- isteklerde uyguladığı ~4.5MB'lık sabit gövde (payload) limiti yüzünden dosya
-- API route'a hiç ulaşamadan 413 ile reddediliyordu. Çözüm: tarayıcı PDF'i
-- doğrudan Supabase Storage'a yükler (function'ı hiç görmeden), sonra sadece
-- dosya yolunu içeren küçük bir JSON isteğiyle işleme tetiklenir.
--
-- Bunun için bucket'a admin rolündeki kullanıcıların doğrudan (service role
-- olmadan) yazabilmesini sağlayan bir RLS policy gerekiyor.

update storage.buckets
set file_size_limit = 209715200, -- 200MB
    allowed_mime_types = array['application/pdf']
where id = 'rag-documents';

drop policy if exists "rag_documents_admin_upload" on storage.objects;
create policy "rag_documents_admin_upload" on storage.objects
  for insert
  with check (
    bucket_id = 'rag-documents'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
