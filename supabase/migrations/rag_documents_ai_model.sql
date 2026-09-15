-- RAG kaynak taslakları (18. prompt) listede "Taslak 1", "Taslak 2" diye anonim görünüyordu —
-- hangi taslağın hangi AI'dan geldiğini görebilmek için (kullanıcının 2026-09-14 isteği).
alter table public.rag_documents
  add column if not exists ai_model text;
