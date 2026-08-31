-- Bazı ders notu PDF'leri Supabase Storage'ın (Free plan) 50MB yükleme limitini
-- aşıyor. Bunlar için admin, PDF'i NotebookLM'e manuel yükleyip ünite ünite düz
-- metin çıktısı alacak ve bu metni sisteme yapıştıracak — dosya hiç Storage'a
-- girmiyor. Bu yüzden rag_documents artık bir dosyaya değil de yapıştırılan
-- metne dayalı kayıtları da temsil edebilmeli.

alter table public.rag_documents alter column file_path drop not null;

alter table public.rag_documents
  add column if not exists source text not null default 'pdf_upload'
    check (source = any (array['pdf_upload', 'notebooklm_text'])),
  add column if not exists unit_id bigint references public.units(id);
