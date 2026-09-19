-- teacher_guide_documents.sql migration'ında bucket oluşturulurken rag-documents'daki
-- (bkz. rag_direct_storage_upload.sql) admin-doğrudan-yükleme RLS policy'si eklenmeyi
-- unutulmuştu — tarayıcı Storage'a doğrudan yazmaya çalışınca "new row violates row-level
-- security policy" ile reddediliyordu (kullanıcı raporu, 2026-09-18).

update storage.buckets
set file_size_limit = 209715200, -- 200MB (gerçek sınır yine de Supabase plan limitine tabi)
    allowed_mime_types = array['application/pdf']
where id = 'teacher-guide-documents';

drop policy if exists "teacher_guide_documents_admin_upload" on storage.objects;
create policy "teacher_guide_documents_admin_upload" on storage.objects
  for insert
  with check (
    bucket_id = 'teacher-guide-documents'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
