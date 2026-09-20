-- Yıllık plan aktarımı (importer.ts) artık var olan ünite/konu/kazanımın üzerine
-- yazıyor (upsert) — bunun için ON CONFLICT hedefleyebileceği gerçek unique
-- constraint'ler gerekiyor. topics_unit_slug_unique canlı veritabanında zaten var
-- (dashboard'da eklenmiş, hiçbir migration dosyasına yansımamıştı — burada sadece
-- belgeleniyor). units(slug) ve outcomes(topic_id, description) için ise eksik
-- olan constraint'ler ekleniyor. Hepsi idempotent: zaten varsa dokunmuyor.

-- Her constraint kendi DO bloğunda: biri (ör. mevcut kirli veride duplicate bulunan
-- outcomes) başarısız olsa bile diğerleri yine de eklenmiş olsun.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'topics_unit_slug_unique' AND conrelid = 'public.topics'::regclass
  ) THEN
    ALTER TABLE public.topics ADD CONSTRAINT topics_unit_slug_unique UNIQUE (unit_id, slug);
  END IF;
END $$;

-- units.slug canlıda tekil olması gereken bir alan (bkz. quizPageData.ts/
-- soruBankasiPageData.ts — sadece slug'a göre .eq() ile tek satır çekiyorlar), ama
-- eski verilerde en az bir çakışma var ("geometrik-sekiller"). Constraint eklemeden
-- önce her çakışan grupta ilk kaydın (en düşük id) slug'ını koruyup diğerlerini
-- lesson_id/grade_id ile (gerekirse id ile) benzersizleştiriyoruz.
DO $$
DECLARE
  dup record;
  r record;
  new_slug text;
  seen_first boolean;
BEGIN
  FOR dup IN
    SELECT slug FROM public.units WHERE slug IS NOT NULL GROUP BY slug HAVING count(*) > 1
  LOOP
    seen_first := false;
    FOR r IN SELECT id, lesson_id, grade_id FROM public.units WHERE slug = dup.slug ORDER BY id LOOP
      IF NOT seen_first THEN
        seen_first := true;
        CONTINUE;
      END IF;
      new_slug := dup.slug || '-' || r.lesson_id || '-' || r.grade_id;
      IF EXISTS (SELECT 1 FROM public.units WHERE slug = new_slug) THEN
        new_slug := new_slug || '-' || r.id;
      END IF;
      UPDATE public.units SET slug = new_slug WHERE id = r.id;
      RAISE NOTICE 'units.slug çakışması düzeltildi: id=% eski="%" yeni="%"', r.id, dup.slug, new_slug;
    END LOOP;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'units_slug_unique' AND conrelid = 'public.units'::regclass
  ) THEN
    ALTER TABLE public.units ADD CONSTRAINT units_slug_unique UNIQUE (slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'outcomes_topic_description_unique' AND conrelid = 'public.outcomes'::regclass
  ) THEN
    IF EXISTS (
      SELECT 1 FROM public.outcomes GROUP BY topic_id, description HAVING count(*) > 1
    ) THEN
      RAISE NOTICE 'outcomes tablosunda (topic_id, description) tekrar eden satırlar var — outcomes_topic_description_unique EKLENMEDİ. Önce duplicate temizliği gerekiyor.';
    ELSE
      ALTER TABLE public.outcomes ADD CONSTRAINT outcomes_topic_description_unique UNIQUE (topic_id, description);
    END IF;
  END IF;
END $$;
