-- MEB (Millî Eğitim Bakanlığı) okul dizini için schools tablosu.
-- Kaynak: https://www.meb.gov.tr/baglantilar/okullar/index.php (okullar_ajax.php)
-- Bu dosyayı Supabase SQL Editor'de bir kez çalıştırın; ardından admin panelindeki
-- Okullar sekmesinden "Okulları Güncelle" ile veriyi doldurabilirsiniz.

CREATE TABLE IF NOT EXISTS public.schools (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  meb_kurum_kodu text UNIQUE,
  name text NOT NULL,
  school_type text NOT NULL CHECK (school_type = ANY (ARRAY['anaokulu', 'ilkokul', 'ortaokul', 'lise'])),
  city_id integer NOT NULL,
  district_id bigint,
  host text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT schools_pkey PRIMARY KEY (id),
  CONSTRAINT fk_schools_city FOREIGN KEY (city_id) REFERENCES public.cities(id),
  CONSTRAINT fk_schools_district FOREIGN KEY (district_id) REFERENCES public.districts(id)
);

CREATE INDEX IF NOT EXISTS idx_schools_city ON public.schools(city_id);
CREATE INDEX IF NOT EXISTS idx_schools_district ON public.schools(district_id);
CREATE INDEX IF NOT EXISTS idx_schools_name ON public.schools(name);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schools_public_read" ON public.schools;
CREATE POLICY "schools_public_read" ON public.schools FOR SELECT USING (true);

-- profiles.school_name zaten serbest metin olarak vardı (geriye dönük uyumluluk için
-- korunuyor); school_id ile artık gerçek bir okula bağlanabiliyor. Kullanıcının okulu
-- dizinde yoksa (özel/uluslararası okul vb.) school_id boş kalıp school_name serbest
-- metin olarak kullanılabilir.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id bigint REFERENCES public.schools(id);
