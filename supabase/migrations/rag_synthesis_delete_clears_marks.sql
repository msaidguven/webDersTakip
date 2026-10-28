-- Bir konunun sentez belgesi (rag_documents: source='ai_generated', is_synthesis=true) silinince
-- admin paneldeki RAG işaretleri de temizlensin (kullanıcının 2026-10-27 isteği: "içerikleri
-- sildiğimde bu işaretler otomatik silinsin"):
--   * konu: açık/çözülmüş "Tutarsızlık Notu" ve Doğruluk Kontrolü notları + rag_last_checked_at
--   * ünite: rag_dedup_checked_at ("3. Ünite Sentezi — kontrol edildi" tiki)
-- Yalnızca konuda hiç sentez belgesi KALMADIYSA temizler; yeniden sentez ve ünite içi tekrar
-- düzeltmesi yeni belgeyi eskisini silmeden önce eklediği için onlarda işaretler korunur.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

create or replace function public.rag_synthesis_deleted_clear_marks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.topic_id is not null
     and not exists (
       select 1 from public.rag_documents d
       where d.topic_id = old.topic_id and d.source = 'ai_generated' and d.is_synthesis = true
     ) then
    delete from public.rag_topic_review_flags where topic_id = old.topic_id;
    update public.topics set rag_last_checked_at = null where id = old.topic_id;
  end if;

  if old.unit_id is not null
     and not exists (
       select 1 from public.rag_documents d
       where d.unit_id = old.unit_id and d.source = 'ai_generated' and d.is_synthesis = true
     ) then
    update public.units set rag_dedup_checked_at = null where id = old.unit_id;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_rag_synthesis_deleted_clear_marks on public.rag_documents;
create trigger trg_rag_synthesis_deleted_clear_marks
  after delete on public.rag_documents
  for each row
  when (old.source = 'ai_generated' and old.is_synthesis = true)
  execute function public.rag_synthesis_deleted_clear_marks();
