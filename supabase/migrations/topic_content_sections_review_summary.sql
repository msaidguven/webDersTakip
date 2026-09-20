-- Konu sunumu (siteye gömülü slayt tekrarı) artık ayrı bir tabloda sonradan
-- özetlenmiyor — içerik üretilirken (otomatik 20dk'lık worker + manuel NotebookLM
-- akışı) AYNI AI çağrısında, alt başlığın kendi satırına yazılıyor. Kullanıcının
-- 2026-09-20 kararı: ayrı çağrı/tablo yerine tek üretim adımı, tutarlılık ve
-- kota tasarrufu için (bkz. project_topic_presentation_export_plan memory).
alter table public.topic_content_sections
  add column if not exists review_summary text;
