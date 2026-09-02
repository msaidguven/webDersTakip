-- get_weekly_leaderboard okudugu user_time_based_stats (period_type='weekly') sadece
-- finish_test_session cagrildiginda (yani ogrenci testin SONUNA kadar gidip sonuc ekranini
-- gordugunde) guncelleniyor. QuizClient bilincli olarak "sayfadan ayrilirsa oturumu otomatik
-- bitirme" mantigi kullandigi icin (kaldigi yerden devam edebilsin diye, bkz.
-- QuizClient.tsx'teki 2026-09-02 tarihli not) cogu oturum hic "bitmiyor" ve bu rollup
-- guncellenmiyordu — bir ogrenci o hafta onlarca soru cozmus olsa bile lider tablosunda
-- gunlerce eski/sabit bir sayi goruyordu (bkz. kullaniciyla 2026-09-02 tartismasi).
--
-- Bu fonksiyon artik dogrudan ham log olan test_session_answers'tan hesapliyor — bir
-- oturumun "bitmis" sayilip sayilmadigindan tamamen bagimsiz, her cevap aninda sayilir.
-- Europe/Istanbul'a cevirip gunluk/haftalik rollup'in kullandigi ayni yerel-hafta mantigini
-- koruyor (bkz. fix_update_user_time_based_stats_timezone.sql).
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_week_start date)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_questions integer,
  is_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grade_id bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.grade_id INTO v_grade_id FROM public.profiles p WHERE p.id = v_user_id;
  IF v_grade_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH weekly_counts AS (
    SELECT a.user_id, COUNT(*)::integer AS total_questions
    FROM public.test_session_answers a
    WHERE a.user_id IS NOT NULL
      AND (a.created_at AT TIME ZONE 'Europe/Istanbul')::date >= p_week_start
      AND (a.created_at AT TIME ZONE 'Europe/Istanbul')::date < (p_week_start + 7)
    GROUP BY a.user_id
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY w.total_questions DESC, w.user_id))::integer AS rank,
    COALESCE(NULLIF(p.username, ''), 'Öğrenci') AS display_name,
    w.total_questions,
    (w.user_id = v_user_id) AS is_me
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE p.grade_id = v_grade_id
    AND w.total_questions > 0
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT 100;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;
