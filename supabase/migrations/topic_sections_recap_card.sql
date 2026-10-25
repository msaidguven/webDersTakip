-- Hap bilgi kartı (2026-10-24, pilot): her alt başlığın sınav kitabı tarzı kısa özeti — renkli
-- başlıklı kart, ara başlıklı madde grupları, ilişkili ilke/kavram etiketleri; matematikte
-- "kural + mini örnek". Yapılandırılmış veri (jsonb), şeması app/src/lib/recapCards.ts'te
-- (normalizeRecapCard). Konu sayfasında kart önde, mevcut anlatım (body_markdown) "Ayrıntılı oku"
-- altında. Boşsa (henüz üretilmemiş) sayfa eskisi gibi görünür.
alter table public.topic_content_sections
  add column if not exists recap_card jsonb;
