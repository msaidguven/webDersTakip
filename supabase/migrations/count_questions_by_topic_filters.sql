-- count_questions_by_topic'e filtre parametreleri (2026-09-27).
--
-- Sorun: soru sayıları birçok yerde (questionCounts.ts, konu sayfası ünite sayacı, sitemap,
-- profil istatistikleri) soru satırları çekilip JS'te sayılıyordu. PostgREST tek istekte en
-- fazla 1000 satır döndürdüğü için toplam 1000'i geçince sayılar sessizce eksik çıkacaktı
-- (şu an ~611 aktif soru var). Anasayfa bu yüzden zaten bu RPC'yi kullanıyordu; artık tüm
-- sayımlar bunu kullanıyor. Öğrenci sayfaları klasik (question_type_id=4, otomatik
-- değerlendirilemeyen) soruları saymadığı, admin ekranları ise pasif soruları da saydığı için
-- iki filtre eklendi. Varsayılanlar eski davranışla aynı (sadece aktif, klasik dahil) —
-- anasayfanın mevcut çağrısı değişmeden aynı sonucu verir.
--
-- Parametre listesi değiştiği için eski imza önce siliniyor (aksi halde iki overload oluşur
-- ve tek parametreli çağrı belirsizleşir).
--
-- SECURITY INVOKER (varsayılan): RLS aynen uygulanır, anon kendi göremediği satırları saymaz.
--
-- ÖNEMLİ: Bu dosyayı, kodu yayına almadan ÖNCE Supabase SQL Editor'de bir kez çalıştırın —
-- yeni kod RPC'yi 3 parametreyle çağırıyor.

DROP FUNCTION IF EXISTS public.count_questions_by_topic(bigint[]);

CREATE FUNCTION public.count_questions_by_topic(
  p_topic_ids bigint[],
  p_active_only boolean DEFAULT true,
  p_exclude_classical boolean DEFAULT false
)
RETURNS TABLE (topic_id bigint, cnt bigint)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT q.topic_id, count(*) AS cnt
  FROM public.questions q
  WHERE q.topic_id = ANY(p_topic_ids)
    AND (NOT p_active_only OR q.is_active = true)
    AND (NOT p_exclude_classical OR q.question_type_id <> 4)
  GROUP BY q.topic_id;
$$;

GRANT EXECUTE ON FUNCTION public.count_questions_by_topic(bigint[], boolean, boolean) TO anon, authenticated;
