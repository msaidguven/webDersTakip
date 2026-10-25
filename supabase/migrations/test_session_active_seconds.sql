-- Testte kalınan süre (2026-10-23): öğrencinin test ekranında, sekme GÖRÜNÜRKEN geçirdiği toplam
-- süre — soru çözme + açıklama okuma + sorular arası. Soru başına çözme süresi ayrı tutuluyor
-- (test_session_answers.duration_seconds). Şimdilik öğrenciye gösterilmiyor, yalnız kaydediliyor.
-- İstemci biriken süreyi parça parça gönderir (sekme gizlenince, testten çıkınca, test bitince).

ALTER TABLE public.test_sessions
  ADD COLUMN IF NOT EXISTS active_seconds integer NOT NULL DEFAULT 0;

-- Kullanıcının test_sessions'a UPDATE izni yok; ekleme yalnız bu RPC'den, yalnız kendi oturumuna.
-- Tek çağrıda en fazla 1 saat eklenir (sekme gizliyken saat durduğu için gerçek bir parça bunu aşmaz).
CREATE OR REPLACE FUNCTION public.add_test_session_active_seconds(p_session_id bigint, p_seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Giriş gerekli' USING ERRCODE = '28000'; END IF;
  IF p_seconds IS NULL OR p_seconds <= 0 THEN RETURN; END IF;
  UPDATE test_sessions
     SET active_seconds = active_seconds + least(p_seconds, 3600)
   WHERE id = p_session_id AND user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.add_test_session_active_seconds(bigint, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_test_session_active_seconds(bigint, integer) TO authenticated;
