-- Anasayfadaki "Haftanın En Çalışkanları" kartı için (2026-09-26). Panel sıralamasından
-- (get_weekly_leaderboard) iki farkı var:
--   1) Sınıf ayrımı yok — henüz öğrenci sayısı az, tüm kademeler tek listede.
--   2) Herkese açık (anon) bir sayfada gösterildiği için kullanıcı adı DEĞİL, ad + soyadın
--      baş harfi ("Ahmet Y.") döner. Google kayıtlarında username e-postanın @ öncesinden
--      üretildiği için (bkz. username_auto_and_profile_prompt.sql) onu herkese açık göstermek
--      e-posta adresini sızdırmak demekti. Tam ad hiçbir zaman fonksiyondan dışarı çıkmaz.
-- Sadece öğrenciler, banlılar hariç. Hafta, Europe/Istanbul'a göre Pazartesi başlar
-- (get_weekly_leaderboard ile aynı mantık) ve sunucu tarafında hesaplanır.
CREATE OR REPLACE FUNCTION public.get_public_weekly_top_students(p_limit integer DEFAULT 5)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_questions integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_week_start date := date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
BEGIN
  RETURN QUERY
  WITH weekly_counts AS (
    SELECT a.user_id, COUNT(*)::integer AS total_questions
    FROM public.test_session_answers a
    WHERE a.user_id IS NOT NULL
      AND a.created_at >= (v_week_start::timestamp AT TIME ZONE 'Europe/Istanbul')
      AND a.created_at < ((v_week_start + 7)::timestamp AT TIME ZONE 'Europe/Istanbul')
    GROUP BY a.user_id
  ),
  ranked AS (
    SELECT
      w.user_id,
      w.total_questions,
      regexp_split_to_array(btrim(regexp_replace(COALESCE(p.full_name, ''), '\s+', ' ', 'g')), ' ') AS parts
    FROM weekly_counts w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE p.role = 'student'
      AND NOT p.is_banned
      AND w.total_questions > 0
    ORDER BY w.total_questions DESC, w.user_id
    LIMIT v_limit
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY r.total_questions DESC, r.user_id))::integer,
    CASE
      WHEN r.parts[1] = '' THEN 'Öğrenci'
      WHEN cardinality(r.parts) = 1 THEN public.tr_capitalize_first(r.parts[1])
      ELSE public.tr_capitalize_first(r.parts[1]) || ' '
           || public.tr_upper_char(left(r.parts[cardinality(r.parts)], 1)) || '.'
    END,
    r.total_questions
  FROM ranked r
  ORDER BY r.total_questions DESC, r.user_id;
END;
$function$;

-- upper() veritabanı locale'ine bağlı ve 'i' → 'I' yapıyor; Türkçede 'i' → 'İ', 'ı' → 'I'.
CREATE OR REPLACE FUNCTION public.tr_upper_char(p_char text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_char WHEN 'i' THEN 'İ' WHEN 'ı' THEN 'I' ELSE upper(p_char) END;
$$;

-- Kullanıcının yazdığı büyük/küçük harfe dokunmadan yalnızca ilk harfi büyütür.
CREATE OR REPLACE FUNCTION public.tr_capitalize_first(p_word text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.tr_upper_char(left(p_word, 1)) || substr(p_word, 2);
$$;

REVOKE ALL ON FUNCTION public.get_public_weekly_top_students(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_weekly_top_students(integer) TO anon, authenticated;
