-- Üye profil kartı için ayrı genel kimlik (2026-10-20, public_profile_card.sql'in devamı). URL'de ve
-- sıralamada artık asıl hesap kimliği (auth uuid) DEĞİL, rastgele ve kısa public_slug kullanılır:
-- hesap kimliği kalıcıdır, giriş sisteminde ve tüm tablolarda geçer, profil fotoğrafının depo yolunda
-- (avatars/<uuid>.webp) bulunur — dışarı çıkmamalı. public_slug gerekirse yenilenebilir.

-- 1) Üretici: 9 rastgele bayt (72 bit) → base64 (12 karakter) → + ve / harfle değiştirilir.
CREATE OR REPLACE FUNCTION public.gen_public_slug()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', 'xy');
$$;

-- 2) Sütun: mevcut satırlar ADD COLUMN sırasında kendi değerini alır (volatil varsayılan satır başına
--    hesaplanır), yeni üyeler kayıtta otomatik alır. Çakışma olasılığı ihmal edilebilir ama benzersizlik
--    yine de dizinle zorunlu.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_slug text NOT NULL DEFAULT public.gen_public_slug();
CREATE UNIQUE INDEX IF NOT EXISTS profiles_public_slug_key ON public.profiles (public_slug);

-- 3) Sıralama: public_id (uuid) yerine public_slug döner. Dönüş tipi değiştiği için DROP + CREATE.
--    Gövde public_profile_card.sql ile aynı; yalnız son sütun değişti.
DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(date);

CREATE FUNCTION public.get_weekly_leaderboard(p_week_start date)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_questions integer,
  is_me boolean,
  public_slug text
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
    CASE WHEN p.public_profile OR w.user_id = v_user_id THEN p.public_slug END AS public_slug
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

-- 4) Profil kartı artık slug ile. Davranış aynı: profil gizliyse (ve çağıran kendisi değilse) HİÇ satır
--    dönmez — ad da fotoğraf da gelmez; "gizli" ile "yok" ayırt edilemez.
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);

CREATE FUNCTION public.get_public_profile(p_slug text)
RETURNS TABLE (
  display_name text,
  avatar_url text,
  grade_name text,
  member_since date,
  current_streak integer,
  weekly_questions integer,
  total_questions integer,
  is_public boolean,
  is_me boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_viewer uuid := auth.uid();
  v_target uuid;
  v_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_week_start date := date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.id INTO v_target
  FROM public.profiles p
  WHERE p.public_slug = p_slug
    AND NOT p.is_banned
    AND p.role IN ('student', 'admin')
    AND (p.public_profile OR p.id = v_viewer);
  IF v_target IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT DISTINCT (a.created_at AT TIME ZONE 'Europe/Istanbul')::date AS d
    FROM public.test_session_answers a
    WHERE a.user_id = v_target
  ),
  islands AS (
    SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::integer AS grp FROM days
  ),
  last_island AS (
    SELECT MAX(d) AS last_day, COUNT(*)::integer AS len
    FROM islands
    WHERE grp = (SELECT grp FROM islands ORDER BY d DESC LIMIT 1)
  ),
  counts AS (
    SELECT
      COUNT(*)::integer AS total_q,
      COUNT(*) FILTER (WHERE (a.created_at AT TIME ZONE 'Europe/Istanbul')::date >= v_week_start)::integer AS weekly_q
    FROM public.test_session_answers a
    WHERE a.user_id = v_target
  )
  SELECT
    public.leaderboard_display_name(p.full_name, p.nickname, p.use_nickname),
    p.avatar_url,
    g.name,
    (u.created_at AT TIME ZONE 'Europe/Istanbul')::date,
    CASE WHEN li.last_day >= v_today - 1 THEN li.len ELSE 0 END,
    c.weekly_q,
    c.total_q,
    p.public_profile,
    (p.id = v_viewer)
  FROM public.profiles p
  LEFT JOIN public.grades g ON g.id = p.grade_id
  LEFT JOIN auth.users u ON u.id = p.id
  CROSS JOIN counts c
  LEFT JOIN last_island li ON true
  WHERE p.id = v_target;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM public;
REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO authenticated;
