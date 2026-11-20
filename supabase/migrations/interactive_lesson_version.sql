-- Etkileşimli ders versiyonlu mimari (v1 → v2 → v3).
-- Mevcut tüm kayıtlar version = 1 (v1) olarak kalır ve PlayerV1 ile açılır.
-- Yeni oyunlaştırılmış etkileşimli dersler version = 2 (v2) olarak kaydedilir ve PlayerV2 ile açılır.
alter table public.interactive_lessons
  add column if not exists version smallint not null default 1 check (version >= 1);

create index if not exists interactive_lessons_version_idx
  on public.interactive_lessons (version, status);
