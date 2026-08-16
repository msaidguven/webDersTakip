-- Alt başlık içeriğinin kaynağını (manuel mi, AI mi) ve AI ise hangi modelin
-- ürettiğini kaydetmek için. topic_contents.source zaten var ama genel/konu
-- seviyesinde; asıl içerik üretimi bölüm (section) bazlı yapıldığı için bu bilgi
-- burada tutulmalı.
alter table public.topic_content_sections
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'ai_generated'));
alter table public.topic_content_sections
  add column if not exists ai_model text;
