-- "Vurgu Kartları" özelliğini "Anahtar Kavramlar" listesine çevirir: kapak görseli
-- etrafındaki 6 sabit pozisyon (top-left, mid-right, vb.) kaldırılır, sıralama
-- artık sadece order_no ile yapılır.
alter table public.topic_content_highlights
  drop constraint if exists topic_content_highlights_position_check,
  drop constraint if exists uq_tch_position,
  drop column if exists position;
