-- Görsellerin gerçek içeriğini anlatan kısa (3-5 kelime) alt metin desteği.
-- AI, görsel üretim promptuyla birlikte bu özeti de üretiyor; SEO/erişilebilirlik
-- için mevcut "sınıf + ders + konu" kalıbının önüne/yerine kullanılabilir.
-- Konu kapak görseli için ayrı bir kolon gerekmiyor: topic_contents.generation_meta
-- (jsonb) içine heroImageAlt anahtarı olarak ekleniyor.
alter table public.topic_content_sections
  add column if not exists image_alt text;
