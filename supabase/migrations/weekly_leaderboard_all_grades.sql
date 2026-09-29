-- Haftalık sıralama tüm sınıflar tek liste (2026-09-29, kullanıcı kararı): öğrenci sayısı az
-- olduğu için sınıf seviyesine göre bölmek listeleri boşaltıyordu; ayrıca profilinde sınıf
-- seçmemiş öğrenci (grade_id NULL) hiçbir listede görünmüyordu ve kendi sayfasında sadece
-- sahte kayıtları görüyordu. Anasayfadaki get_public_weekly_top_students ile aynı kapsam.
-- Öğrenci sayısı artınca sınıf filtresi geri eklenebilir (eski sürüm:
-- panel_lesson_progress_and_leaderboard_names.sql).
-- Kurallar aynı: sadece öğrenciler + banlılar hariç; çağıranın kendi satırı rolü ne olursa
-- olsun görünür (admin kendini test edebilsin); isim "Ad S." (format_public_name).

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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
    public.format_public_name(p.full_name) AS display_name,
    w.total_questions,
    (w.user_id = v_user_id) AS is_me
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE w.total_questions > 0
    AND ((p.role = 'student' AND NOT p.is_banned) OR w.user_id = v_user_id)
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT 100;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;
