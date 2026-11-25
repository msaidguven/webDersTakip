-- Üye profil kartı etkileşim, rozet, aktivite ve güvenli tepki sistemi (2026-11-24).
-- 1) profile_reactions: serbest metin olmadan tek tık motivasyon tepkileri ('clap', 'fire', 'rival').
-- 2) get_public_profile(p_slug): rozet metrikleri (longest_streak, active_days), bu haftanın aktif günleri
--    (Pzt..Paz 7'li dizi), en çok soru çözülen ders, ziyareti yapan üyenin bu haftaki soru sayısı (düello çubuğu)
--    ve tepki sayaçlarını TEK sorguda döndürür.
--    Misafir (anon) paylaşılan linkten geldiğinde yalnız public_profile = true olan kartların güvenli özetini
--    görebilir (fotoğraf yolu / uuid anonim ziyaretçiye dönmez, baş harf gösterilir).
-- 3) react_to_public_profile(p_slug, p_reaction): tepki ekler/değiştirir/kaldırır ve spam korumalı (12 saatte en fazla 1)
--    bildirim üretir.

CREATE TABLE IF NOT EXISTS public.profile_reactions (
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('clap', 'fire', 'rival')),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (target_user_id, sender_user_id),
  CONSTRAINT profile_reactions_no_self CHECK (target_user_id <> sender_user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_reactions_target ON public.profile_reactions (target_user_id, reaction);

ALTER TABLE public.profile_reactions ENABLE ROW LEVEL SECURITY;
-- Doğrudan tablo erişimi kapalı; okuma ve yazma yalnız SECURITY DEFINER RPC'ler üzerinden yapılır.

DROP FUNCTION IF EXISTS public.get_public_profile(text);

CREATE FUNCTION public.get_public_profile(p_slug text)
RETURNS TABLE (
  display_name text,
  avatar_url text,
  grade_name text,
  member_since date,
  current_streak integer,
  longest_streak integer,
  active_days integer,
  weekly_questions integer,
  total_questions integer,
  week_active_days boolean[],
  favorite_lesson text,
  viewer_weekly_questions integer,
  clap_count integer,
  fire_count integer,
  rival_count integer,
  my_reaction text,
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
  v_week_start_ts timestamp with time zone := (v_week_start::timestamp AT TIME ZONE 'Europe/Istanbul');
  v_week_end_ts timestamp with time zone := ((v_week_start + 7)::timestamp AT TIME ZONE 'Europe/Istanbul');
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[A-Za-z0-9]{12}$' THEN
    RETURN;
  END IF;

  SELECT p.id INTO v_target
  FROM public.profiles p
  WHERE p.public_slug = p_slug
    AND NOT p.is_banned
    AND p.role IN ('student', 'admin')
    AND (p.public_profile OR (v_viewer IS NOT NULL AND p.id = v_viewer));

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
  island_lengths AS (
    SELECT grp, MAX(d) AS last_day, COUNT(*)::integer AS len
    FROM islands
    GROUP BY grp
  ),
  last_island AS (
    SELECT il.last_day, il.len
    FROM island_lengths il
    ORDER BY il.last_day DESC
    LIMIT 1
  ),
  streak_totals AS (
    SELECT
      (SELECT COUNT(*)::integer FROM days) AS total_days,
      (SELECT COALESCE(MAX(il.len), 0)::integer FROM island_lengths il) AS max_streak
  ),
  counts AS (
    SELECT
      COUNT(*)::integer AS total_q,
      COUNT(*) FILTER (WHERE a.created_at >= v_week_start_ts AND a.created_at < v_week_end_ts)::integer AS weekly_q
    FROM public.test_session_answers a
    WHERE a.user_id = v_target
  ),
  fav_lesson AS (
    SELECT l.name AS lesson_name
    FROM public.test_session_answers a
    JOIN public.questions q ON q.id = a.question_id
    JOIN public.topics tp ON tp.id = q.topic_id
    JOIN public.units un ON un.id = tp.unit_id
    JOIN public.lessons l ON l.id = un.lesson_id
    WHERE a.user_id = v_target
    GROUP BY l.id, l.name
    ORDER BY COUNT(*) DESC, l.id ASC
    LIMIT 1
  ),
  viewer_counts AS (
    SELECT
      CASE
        WHEN v_viewer IS NULL THEN NULL
        WHEN v_viewer = v_target THEN NULL
        ELSE (
          SELECT COUNT(*)::integer
          FROM public.test_session_answers a
          WHERE a.user_id = v_viewer
            AND a.created_at >= v_week_start_ts
            AND a.created_at < v_week_end_ts
        )
      END AS viewer_q
  ),
  reaction_totals AS (
    SELECT
      COUNT(*) FILTER (WHERE pr.reaction = 'clap')::integer AS claps,
      COUNT(*) FILTER (WHERE pr.reaction = 'fire')::integer AS fires,
      COUNT(*) FILTER (WHERE pr.reaction = 'rival')::integer AS rivals,
      MAX(pr.reaction) FILTER (WHERE v_viewer IS NOT NULL AND pr.sender_user_id = v_viewer) AS mine
    FROM public.profile_reactions pr
    WHERE pr.target_user_id = v_target
  )
  SELECT
    public.leaderboard_display_name(p.full_name, p.nickname, p.use_nickname),
    -- Anonim (girişsiz) ziyaretçiye depo yolundaki uuid sızmasın; yalnız girişli üyelere fotoğraf döner.
    CASE WHEN v_viewer IS NOT NULL THEN p.avatar_url END,
    g.name,
    (u.created_at AT TIME ZONE 'Europe/Istanbul')::date,
    CASE WHEN li.last_day >= v_today - 1 THEN li.len ELSE 0 END,
    st.max_streak,
    st.total_days,
    c.weekly_q,
    c.total_q,
    ARRAY(
      SELECT EXISTS (SELECT 1 FROM days WHERE d = v_week_start + offs)
      FROM generate_series(0, 6) AS offs
    ),
    fl.lesson_name,
    vc.viewer_q,
    rt.claps,
    rt.fires,
    rt.rivals,
    rt.mine,
    p.public_profile,
    (v_viewer IS NOT NULL AND p.id = v_viewer)
  FROM public.profiles p
  LEFT JOIN public.grades g ON g.id = p.grade_id
  LEFT JOIN auth.users u ON u.id = p.id
  CROSS JOIN counts c
  CROSS JOIN streak_totals st
  CROSS JOIN viewer_counts vc
  CROSS JOIN reaction_totals rt
  LEFT JOIN last_island li ON true
  LEFT JOIN fav_lesson fl ON true
  WHERE p.id = v_target;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated;

-- Güvenli tek tık tepki ekleme / değiştirme / geri alma.
CREATE OR REPLACE FUNCTION public.react_to_public_profile(p_slug text, p_reaction text)
RETURNS TABLE (
  clap_count integer,
  fire_count integer,
  rival_count integer,
  my_reaction text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sender uuid := auth.uid();
  v_target uuid;
  v_existing text;
  v_sender_banned boolean;
  v_sender_name text;
  v_emoji text;
  v_label text;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_reaction IS NOT NULL AND p_reaction NOT IN ('clap', 'fire', 'rival') THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  SELECT p.is_banned, public.leaderboard_display_name(p.full_name, p.nickname, p.use_nickname)
    INTO v_sender_banned, v_sender_name
  FROM public.profiles p
  WHERE p.id = v_sender;

  IF v_sender_banned IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.id INTO v_target
  FROM public.profiles p
  WHERE p.public_slug = p_slug
    AND p.public_profile = true
    AND NOT p.is_banned
    AND p.role IN ('student', 'admin');

  IF v_target IS NULL OR v_target = v_sender THEN
    RAISE EXCEPTION 'Invalid target';
  END IF;

  SELECT pr.reaction INTO v_existing
  FROM public.profile_reactions pr
  WHERE pr.target_user_id = v_target
    AND pr.sender_user_id = v_sender;

  IF p_reaction IS NULL OR v_existing = p_reaction THEN
    DELETE FROM public.profile_reactions
    WHERE target_user_id = v_target
      AND sender_user_id = v_sender;
  ELSE
    INSERT INTO public.profile_reactions (target_user_id, sender_user_id, reaction, updated_at)
    VALUES (v_target, v_sender, p_reaction, now())
    ON CONFLICT (target_user_id, sender_user_id)
    DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now();

    -- Bildirim spam koruması: aynı göndericiden son 12 saatte bildirim gittiyse tekrar gönderme.
    v_emoji := CASE p_reaction WHEN 'clap' THEN '👏' WHEN 'fire' THEN '🔥' ELSE '🚀' END;
    v_label := CASE p_reaction WHEN 'clap' THEN 'Tebrikler' WHEN 'fire' THEN 'Serin harika' ELSE 'Böyle devam!' END;

    IF NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = v_target
        AND n.type = 'profile_reaction'
        AND n.created_at > now() - interval '12 hours'
        AND n.body LIKE v_sender_name || ' %'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (
        v_target,
        'profile_reaction',
        v_emoji || ' Profil kartına yeni tepki!',
        v_sender_name || ' kartına "' || v_label || '" tepkisi bıraktı.',
        '/uye/' || p_slug
      );
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE pr.reaction = 'clap')::integer,
    COUNT(*) FILTER (WHERE pr.reaction = 'fire')::integer,
    COUNT(*) FILTER (WHERE pr.reaction = 'rival')::integer,
    MAX(pr.reaction) FILTER (WHERE pr.sender_user_id = v_sender)
  FROM public.profile_reactions pr
  WHERE pr.target_user_id = v_target;
END;
$function$;

REVOKE ALL ON FUNCTION public.react_to_public_profile(text, text) FROM public;
REVOKE ALL ON FUNCTION public.react_to_public_profile(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.react_to_public_profile(text, text) TO authenticated;
