-- Alt başlıklara, harici görsel üretim aracına ihtiyaç duymadan (ör. matematikte sayı
-- doğrusu, kesir modeli, ölçü etiketli geometrik şekil gibi kesin sayı/etiket taşıyan
-- diyagramlar için) doğrudan AI'ın ürettiği vektör (SVG) kod eklemek amacıyla.
-- image_url/image_prompt'tan bağımsızdır; bir section hem raster görsel hem SVG diyagram
-- taşıyabilir. Render tarafında ham SVG, DOMPurify ile sıkı bir allowlist üzerinden
-- temizlenip basılır (bkz. app/src/lib/sanitizeSvg.ts).
alter table public.topic_content_sections
  add column if not exists diagram_svg text;
