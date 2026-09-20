-- units.slug'ın GLOBAL unique olması (units_slug_unique, yillik_plan_upsert_constraints.sql),
-- ünite oluşturulurken slug'a hep "-{lessonId}-{gradeId}" eklenmesine sebep oluyordu
-- (app/src/lib/yillikPlan/importer.ts) — oysa ünite hiçbir yerde sadece slug'la aranmıyor,
-- her zaman grade_id + lesson_id + slug ile aranıyor (bkz. unitOverviewPageData.ts). Yani
-- global unique hiç gerekli değildi, sadece çirkin URL'lere (".../unite-adi-7-6") sebep oldu
-- (kullanıcının 2026-09-21 bulduğu sorun).
--
-- İlk düzeltmede bunu composite bir unique'e (lesson_id, grade_id, slug) indirmiştim, ama
-- kullanıcı bunu da istemedi: aynı ders+sınıfta aynı isme/slug'a sahip iki farklı ünite
-- olabilir (gerçek müfredatta tekrar eden ünite adları), bu durumda insert/upsert unique-
-- violation'la başarısız olup içe aktarımı kesmemeli. Bu yüzden slug üzerinde HİÇBİR
-- unique constraint kalmıyor — importer'lar zaten artık numaralandırma/eklenti yapmıyor
-- (bkz. yillikPlan/importer.ts, tymm/importUnit.ts), aynı slug'lı birden fazla satır DB'de
-- rahatça durabilir. Buna karşılık, slug ile ünite arayan tüm public sorgular (.maybeSingle())
-- artık .order('id').limit(1) ile "ilk satırı al" mantığına çevrildi (bkz. quizPageData.ts,
-- soruBankasiPageData.ts, unitOverviewPageData.ts) — aksi halde birden fazla satır eşleşince
-- PostgREST hata verirdi.
alter table public.units drop constraint if exists units_slug_unique;
alter table public.units drop constraint if exists units_lesson_grade_slug_unique;
