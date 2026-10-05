-- Öğretmen kılavuzundan konu başına çıkarılan bilginin genişletilmesi (2026-10-04).
--
-- Önceki şema konu başına yalnız recommended_hours + 2-3 cümlelik emphasis_notes tutuyordu;
-- kılavuzun kapsam/tanım/örnek bilgisi içe aktarmada atılıyordu. Kitapsız derslerde (Bilişim)
-- RAG kaynak metnini yazan 5 AI bu yüzden kılavuzu neredeyse hiç görmüyordu.
--
-- source_text / source_pages: kılavuz PDF'inin bu konuya ait ham bölümü (bkz.
-- splitGuideByTopic.ts) — yapılandırma yeniden gerekirse PDF'e dönmeden buradan yapılır.
-- Diğer alanlar bu metinden AI ile çıkarılan yapılandırılmış bilgi (bkz.
-- app/prompt/34-teacher-guide-topic-extract.md). Hepsi NULL olabilir; eski kayıtlar bozulmaz.

alter table public.topic_teacher_guide_notes
  add column if not exists source_text text,
  add column if not exists source_pages text,
  add column if not exists content_points text[],
  add column if not exists key_terms jsonb,
  add column if not exists examples text[],
  add column if not exists scope_notes text,
  add column if not exists misconceptions text[],
  add column if not exists prerequisites text,
  add column if not exists assessment_notes text;

-- Yerel betikle (scripts/import-teacher-guide-pdf.ts) PDF metninden içe aktarılan kılavuzlar.
alter table public.teacher_guide_documents drop constraint if exists teacher_guide_documents_source_check;
alter table public.teacher_guide_documents
  add constraint teacher_guide_documents_source_check
  check (source = any (array['pdf_upload', 'notebooklm_json', 'pdf_text_import']));
