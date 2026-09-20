-- Konu içeriğinden admin panelde AI ile üretilen, öğrenciye slayt gösterisi
-- (sunum) olarak gömülü gösterilecek özet madde listesi. topic_content_sections
-- gibi paylaşılan referans içerik olduğu için RLS yok — görünürlük, diğer içerik
-- tabloları gibi uygulama katmanında topic_contents.is_published üzerinden
-- kontrol ediliyor (kullanıcının 2026-09-20 isteği: sunumu indirmek değil,
-- konu sayfasına gömülü slayt olarak göstermek).
create table if not exists public.topic_content_slides (
  id bigint generated always as identity primary key,
  topic_content_id bigint not null unique references public.topic_contents(id) on delete cascade,
  slides jsonb not null,
  ai_model text,
  generated_at timestamptz not null default now()
);

-- Diğer içerik tablolarının aksine bu proje için varsayılan izinler yeni tabloya
-- otomatik gelmedi (anon rolü SELECT yapamıyordu, test sırasında fark edildi,
-- 2026-09-20) — açıkça veriyoruz. Supabase dashboard'ın yeni tablolarda RLS'i
-- varsayılan AÇIK oluşturması ihtimaline karşı da açıkça kapatıyoruz — bu tablo
-- topic_content_sections gibi paylaşılan referans içerik, RLS politikasına gerek yok.
alter table public.topic_content_slides disable row level security;
grant select on public.topic_content_slides to anon, authenticated;
