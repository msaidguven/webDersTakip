-- Haftalık sıralamaya admin de girsin (2026-10-02, kullanıcı isteği). Öğretmenler hâlâ hariç,
-- banlılar hariç. Yalnız rol koşulu değişti; geri kalanı leaderboard_full_names_and_nickname.sql ile aynı.
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
  )
  SELECT
    (ROW_NUMBER() OVER (ORDER BY w.total_questions DESC, w.user_id))::integer,
    public.leaderboard_display_name(p.full_name, p.nickname, p.use_nickname),
    w.total_questions
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE p.role IN ('student', 'admin')
    AND NOT p.is_banned
    AND w.total_questions > 0
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT v_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_weekly_top_students(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_weekly_top_students(integer) TO anon, authenticated;

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
    public.leaderboard_display_name(p.full_name, p.nickname, p.use_nickname) AS display_name,
    w.total_questions,
    (w.user_id = v_user_id) AS is_me
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE w.total_questions > 0
    AND ((p.role IN ('student', 'admin') AND NOT p.is_banned) OR w.user_id = v_user_id)
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT 100;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;
