-- Alt başlık içeriğini ikiye ayırıyoruz: body_markdown artık "Konu Anlatımı" rolünde
-- (öğretmenin sınıfta anlatacağı / öğrencinin akıcı okuyacağı metin), notebook_markdown
-- ise öğrencinin defterine geçireceği kısa, ezberlenebilir özet (madde madde,
-- "terim: kısa tanım" biçiminde, tam cümle değil). Bkz. 20-rag-synthesis-full-topic.md.
alter table public.topic_content_sections
  add column if not exists notebook_markdown text;
