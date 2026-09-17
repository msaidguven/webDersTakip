-- Alt başlıklara opsiyonel kısa video desteği (kullanıcının 2026-09-16 isteği):
-- 1) AI ana içerik üretirken (03/20/23/24. promptlar) needs_video kararını verip
--    video_prompt yazabiliyor — görsel/image_prompt ile birebir aynı desen, admin bunu
--    kopyalayıp bir video üretim modeline (ör. Veo) verip sonucu video_url'e ekliyor.
-- 2) Ayrı bir akış: AI'a "bu alt başlık için gerçek bir YouTube videosu bul" promptu
--    verilip dönen öneriler topic_section_video_suggestions'a EKLENİYOR (var olanlar
--    silinmiyor) — admin farklı AI'lardan gelen önerileri inceleyip birini onaylayınca
--    o önerinin video_url'i topic_content_sections.video_url'e kopyalanıyor.
alter table public.topic_content_sections
  add column if not exists video_prompt text,
  add column if not exists video_url text,
  add column if not exists video_type text check (video_type in ('ai_generated', 'youtube'));

create table if not exists public.topic_section_video_suggestions (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.topic_content_sections(id) on delete cascade,
  video_url text not null,
  video_title text,
  note text,
  ai_model text,
  created_at timestamptz not null default now()
);

create index if not exists topic_section_video_suggestions_section_id_idx
  on public.topic_section_video_suggestions(section_id);

-- Sadece admin API route'ları (service role, RLS'yi bypass eder) erişir — RAG kaynak
-- taslakları tablosuyla aynı desen, herkese açık bir politika tanımlanmıyor.
alter table public.topic_section_video_suggestions enable row level security;
