-- Anasayfadaki istatistik çubuğu iki ayrı gerçek sorun içeriyordu (2026-09-10 kullanıcı
-- bildirimi):
--
-- 1) "Soru" sayısı hep 1000 görünüyordu — homeStats.ts'teki getPublishedUnitContent,
--    questions tablosunu topic_id'ye göre GRUPLAMAK için tüm satırları (id, topic_id) çekip
--    client'ta sayıyordu. PostgREST'in varsayılan satır limiti 1000 — DB'de 1189 aktif soru
--    varken (bu migration'ın yazıldığı an) sorgu sessizce ilk 1000'de kesiliyordu, sayfalama
--    (.range()) da yoktu. Aşağıdaki count_questions_by_topic RPC'si sayımı DB tarafında
--    (GROUP BY ile) yapıyor — kaç soru olursa olsun tek satır/konu dönüyor, 1000 limitine
--    hiç takılmıyor.
--
-- 2) "Öğrenci" sayısı DISPLAYED_STUDENT_COUNT=2388 diye sabitti (2026-09-01'de, gerçek sayı
--    küçükken "daha gerçekçi görünsün" diye bilinçli eklenmiş bir kullanıcı kararıydı — şimdi
--    gerçek sayıyı istiyor). profiles tablosu RLS ile sadece "kendi satırın" okunabiliyor,
--    anasayfa ise anon client kullanıyor — bu yüzden SECURITY DEFINER bir fonksiyon gerekiyor,
--    ama kasıtlı olarak SADECE bir sayı (COUNT) döndürüyor, hiçbir profil satırı/alanı sızdırmıyor.

CREATE OR REPLACE FUNCTION public.count_questions_by_topic(p_topic_ids bigint[])
RETURNS TABLE (topic_id bigint, cnt bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT topic_id, count(*) AS cnt
  FROM public.questions
  WHERE topic_id = ANY(p_topic_ids) AND is_active = true
  GROUP BY topic_id;
$$;
GRANT EXECUTE ON FUNCTION public.count_questions_by_topic(bigint[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_student_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.profiles WHERE role = 'student';
$$;
GRANT EXECUTE ON FUNCTION public.get_public_student_count() TO anon, authenticated;
