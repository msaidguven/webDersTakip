-- Kök neden: outcomes/outcome_weeks tablolarına INSERT/UPDATE/DELETE yapıldığında
-- (ör. admin panelde TYMM'den ünite kaydetme, veya "Haftaları Kaydet") aşağıdaki trigger
-- zinciri tetikleniyordu:
--   outcomes/outcome_weeks değişikliği
--     -> trg_refresh_tco_on_outcomes_change / trg_refresh_tco_on_outcome_weeks_change
--     -> refresh_topic_content_outcomes_for_topic(...)
--     -> bu fonksiyon public.topic_content_weeks tablosuyla JOIN yapıyordu
-- topic_content_weeks çoktan kaldırılmış bir tablo (bkz. app/src/lib/yillikPlan/
-- importer.ts'teki not — güncel sitede her konunun topic_contents'te TEK bir kaydı var,
-- haftalar artık outcome_weeks'te tutuluyor) — bu yüzden her tetiklenişte
-- "relation public.topic_content_weeks does not exist" hatasıyla patlıyordu
-- (kullanıcının 2026-09-09 bildirdiği "TYMM'den yıllık plan eklerken" hatası).
--
-- Bu tüm zincir, topic_content_outcomes tablosunu senkron tutmaya çalışıyordu — ama o
-- tabloyu okuyan hiçbir web kodu yok (grep ile doğrulandı; güncel karşılığı
-- topic_content_section_outcomes, o ayrı ve sağlıklı). Yani zincir tamamen ölü kod,
-- sadece hata üretiyordu — "düzeltmek" değil kaldırmak doğru çözüm.
--
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın.

drop trigger if exists trg_refresh_tco_on_outcomes_change on public.outcomes;
drop trigger if exists trg_refresh_tco_on_outcome_weeks_change on public.outcome_weeks;

drop function if exists public.trg_refresh_tco_on_outcomes_change();
drop function if exists public.trg_refresh_tco_on_outcome_weeks_change();
drop function if exists public.refresh_topic_content_outcomes_for_topic;
drop function if exists public.refresh_topic_content_outcomes_for_content;
drop function if exists public.refresh_all_topic_content_outcomes;

-- Aynı sebeple kırık, ve kodda hiç çağrılmayan (bkz. silinen
-- app/src/viewmodels/useDersViewModel.ts) bir başka fonksiyon:
drop function if exists public.web_get_topic_contents_for_week;
