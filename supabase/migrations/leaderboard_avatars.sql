-- Haftalık sıralamada profil fotoğrafı desteği (2026-11-24, kullanıcı isteği).
-- Gizlilik kuralı public_slug ile birebir aynı: yalnız profil kartı açık olan (p.public_profile = true)
-- üyelerin veya çağıranın kendi satırının (w.user_id = v_user_id) avatar_url değeri döner.
-- Profilini gizlemiş üyelerde NULL döner; istemci baş harf rozeti gösterir.

DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(date);

CREATE FUNCTION public.get_weekly_leaderboard(p_week_start date)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_questions integer,
  is_me boolean,
  public_slug text,
  avatar_url text
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
    public.leaderboard_display_name(p.full_name, p.nickname, p.use_nickname) AS display_name,
    w.total_questions,
    (w.user_id = v_user_id) AS is_me,
    CASE WHEN p.public_profile OR w.user_id = v_user_id THEN p.public_slug END AS public_slug,
    CASE WHEN p.public_profile OR w.user_id = v_user_id THEN p.avatar_url END AS avatar_url
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE w.total_questions > 0
    AND ((p.role IN ('student', 'admin') AND NOT p.is_banned) OR w.user_id = v_user_id)
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_weekly_leaderboard(date) FROM public;
REVOKE ALL ON FUNCTION public.get_weekly_leaderboard(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;
