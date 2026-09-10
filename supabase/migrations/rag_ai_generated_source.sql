-- MEB'in kitap yayınlamadığı dersler için: admin artık "kitaptan çıkar" (NotebookLM)
-- yerine, o konunun kazanımlarına dayanarak AI'a SIFIRDAN kaynak metin yazdırıp aynı
-- from-text ucundan kaydedebiliyor (bkz. app/prompt/18-rag-topic-source-notext.md,
-- app/api/admin/rag/topic-source-prompt/route.ts). Bu içeriğin gerçek bir kitaptan
-- ÇIKARILMADIĞINI (kaynağın kendisinin de AI ürünü olduğunu) admin panelinde ayırt
-- edebilmek için ayrı bir source değeri gerekiyor — 'notebooklm_text' ile karıştırılırsa
-- admin hangi belgelerin gerçek bir kitaba dayandığını hangilerinin dayanmadığını
-- göremez.
alter table public.rag_documents drop constraint if exists rag_documents_source_check;
alter table public.rag_documents
  add constraint rag_documents_source_check
  check (source = any (array['pdf_upload', 'notebooklm_text', 'ai_generated']));
