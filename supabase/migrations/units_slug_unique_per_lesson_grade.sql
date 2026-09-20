-- units.slug'ın GLOBAL unique olması (units_slug_unique, yillik_plan_upsert_constraints.sql),
-- ünite oluşturulurken slug'a hep "-{lessonId}-{gradeId}" eklenmesine sebep oluyordu
-- (app/src/lib/yillikPlan/importer.ts) — oysa ünite hiçbir yerde sadece slug'la aranmıyor,
-- her zaman grade_id + lesson_id + slug ile aranıyor (bkz. unitOverviewPageData.ts). Yani
-- global unique hiç gerekli değildi, sadece çirkin URL'lere (".../unite-adi-7-6") sebep oldu
-- (kullanıcının 2026-09-21 bulduğu sorun). Kısıtı gerçek kullanım şekliyle eşleşen bir
-- composite unique'e (lesson_id, grade_id, slug) indiriyoruz.
alter table public.units drop constraint if exists units_slug_unique;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'units_lesson_grade_slug_unique' and conrelid = 'public.units'::regclass
  ) then
    alter table public.units add constraint units_lesson_grade_slug_unique unique (lesson_id, grade_id, slug);
  end if;
end $$;
