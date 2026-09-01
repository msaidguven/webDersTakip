-- Panelin haftalık, sınıf seviyesi bazlı lider tablosu için. user_time_based_stats ve
-- profiles tabloları normal (RLS'li) authenticated bağlantıdan yalnızca "kendi satırın"
-- politikasıyla okunabiliyor, bu yüzden başka öğrencilerin verisini karşılaştırmalı olarak
-- göstermek SECURITY DEFINER bir fonksiyon gerektiriyor. Fonksiyon kasıtlı olarak sadece
-- rank/display_name/total_questions/is_me döner — hiçbir zaman user_id, full_name, email
-- gibi kimliklendirici alanları client'a sızdırmaz; display_name yalnızca profiles.username
-- (kullanıcının kendi seçtiği takma ad) varsa gösterilir, yoksa "Öğrenci" döner.
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
  SELECT
    (ROW_NUMBER() OVER (ORDER BY s.total_questions DESC, s.user_id))::integer AS rank,
    COALESCE(NULLIF(p.username, ''), 'Öğrenci') AS display_name,
    s.total_questions,
    (s.user_id = v_user_id) AS is_me
  FROM public.user_time_based_stats s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.period_type = 'weekly'
    AND s.period_date = p_week_start
    AND p.grade_id = v_grade_id
    AND s.total_questions > 0
  ORDER BY s.total_questions DESC, s.user_id
  LIMIT 100;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(date) TO authenticated;
