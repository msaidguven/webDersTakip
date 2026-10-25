-- Üye profil kartı (2026-10-20, kullanıcı kararı). Varsayılan AÇIK (mevcut üyeler dahil); öğrenci
-- Ayarlar'dan gizleyebilir. Açıkken sıralamadaki adı tıklanabilir olur ve /uye/<id> sayfasında güvenli bir kart
-- görünür: görünen ad, fotoğraf, sınıf, seri, soru sayıları, üyelik ayı. Kullanıcı adı, e-posta, okul,
-- il/ilçe ASLA dönmez. Yalnız giriş yapmış üyeler çağırabilir.

-- 1) Tercih sütunu — varsayılan açık (ADD COLUMN ... DEFAULT true mevcut satırları da true yapar).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_profile boolean NOT NULL DEFAULT true;

-- 2) Sıralama: profilini açmış öğrencinin kimliği (public_id) döner, diğerlerinde NULL.
--    Dönüş tipi değiştiği için önce DROP gerekir (CREATE OR REPLACE dönüş tipini değiştiremez).
--    Gövde leaderboard_include_admin.sql ile aynı; yalnız public_id sütunu eklendi.
DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(date);

CREATE FUNCTION public.get_weekly_leaderboard(p_week_start date)
RETURNS TABLE (
  rank integer,
  display_name text,
  total_questions integer,
  is_me boolean,
  public_id uuid
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
    CASE WHEN p.public_profile OR w.user_id = v_user_id THEN w.user_id END AS public_id
  FROM weekly_counts w
  JOIN public.profiles p ON p.id = w.user_id
  WHERE w.total_questions > 0
    AND ((p.role IN ('student', 'admin') AND NOT p.is_banned) OR w.user_id = v_user_id)
  ORDER BY w.total_questions DESC, w.user_id
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_weekly_leaderboard(date) FROM public;
-- Supabase yeni fonksiyonlara anon'a varsayılan EXECUTE verir; FROM public bunu kaldırmaz.
REVOKE ALL ON FUNCTION public.get_weekly_leaderboard(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;

-- 3) Profil kartı. Profil kapalıysa (ve çağıran kendisi değilse) hiç satır dönmez — "gizli" ile
--    "yok" ayırt edilemez, kapalı profilin varlığı da sızmaz.
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
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
  v_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_week_start date := date_trunc('week', now() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH target AS (
    SELECT p.id, p.full_name, p.nickname, p.use_nickname, p.avatar_url, p.grade_id, p.public_profile
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND NOT p.is_banned
      AND p.role IN ('student', 'admin')
      AND (p.public_profile OR p.id = v_viewer)
  ),
  days AS (
    SELECT DISTINCT (a.created_at AT TIME ZONE 'Europe/Istanbul')::date AS d
    FROM public.test_session_answers a
    WHERE a.user_id = p_user_id
  ),
  -- Ardışık gün adaları: d - sıra numarası aynı olan günler kesintisiz bir seri.
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
    WHERE a.user_id = p_user_id
  )
  SELECT
    public.leaderboard_display_name(t.full_name, t.nickname, t.use_nickname),
    t.avatar_url,
    g.name,
    (u.created_at AT TIME ZONE 'Europe/Istanbul')::date,
    -- Seri bugün ya da dün biten adadır; daha önce bittiyse seri 0 (bkz. getCurrentStreak).
    CASE WHEN li.last_day >= v_today - 1 THEN li.len ELSE 0 END,
    c.weekly_q,
    c.total_q,
    t.public_profile,
    (t.id = v_viewer)
  FROM target t
  LEFT JOIN public.grades g ON g.id = t.grade_id
  LEFT JOIN auth.users u ON u.id = t.id
  CROSS JOIN counts c
  LEFT JOIN last_island li ON true;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM public;
-- Supabase yeni fonksiyonlara anon'a varsayılan EXECUTE verir; FROM public bunu kaldırmaz.
REVOKE ALL ON FUNCTION public.get_public_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;
