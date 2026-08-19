-- Admin panelde eğitim-öğretim yılının 1. haftasının hangi takvim tarihine denk
-- geldiğini (term_start_date) tek satırlık bir ayar olarak saklar. getCurrentCurriculumWeek/
-- getWeekDateRange (app/src/lib/routeParsing.ts) artık sabit "Eylül'ün ilk Pazartesi'si"
-- varsayımı yerine bu tarihi kullanıyor — admin /admin/takvim sayfasından değiştirebiliyor.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

create table if not exists public.curriculum_calendar_settings (
  id bigint primary key default 1,
  term_start_date date not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  constraint curriculum_calendar_settings_singleton check (id = 1)
);
