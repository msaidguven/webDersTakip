-- Haftalık sıralamada tam ad + isteğe bağlı takma ad (2026-10-02, kullanıcı kararı).
-- "Ad S." yerine tam ad gösterilir (öğrenci arkadaşlarına "bu benim" diyebilsin). Adının
-- görünmesini istemeyen profilinden takma ad yazıp "sıralamada takma adım görünsün"ü seçer.
-- İki RPC'nin yalnız isim ifadesi değişti; kapsam/kurallar weekly_leaderboard_all_grades.sql
-- ve panel_lesson_progress_and_leaderboard_names.sql ile aynı. format_public_name artık
-- kullanılmıyor ama geri dönüş için silinmedi.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS use_nickname boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nickname_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_nickname_length CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 2 AND 24);

-- Sıralamada görünen ad: takma ad seçiliyse o, değilse tam ad (her kelimenin ilk harfi büyük,
-- fazla boşluklar atılır, 40 karakterle sınırlı). İkisi de boşsa "Öğrenci".
CREATE OR REPLACE FUNCTION public.leaderboard_display_name(p_full_name text, p_nickname text, p_use_nickname boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH n AS (
    SELECT
      btrim(regexp_replace(COALESCE(p_nickname, ''), '\s+', ' ', 'g')) AS nick,
      btrim(regexp_replace(COALESCE(p_full_name, ''), '\s+', ' ', 'g')) AS full_name
  )
  SELECT CASE
    WHEN p_use_nickname AND nick <> '' THEN nick
    WHEN full_name = '' THEN 'Öğrenci'
    ELSE left((
      SELECT string_agg(public.tr_capitalize_first(w), ' ' ORDER BY i)
      FROM unnest(string_to_array(full_name, ' ')) WITH ORDINALITY AS t(w, i)
    ), 40)
  END
  FROM n;
$$;

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
  WHERE p.role = 'student'
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
    AND ((p.role = 'student' AND NOT p.is_banned) OR w.user_id = v_user_id)
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT 100;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;
