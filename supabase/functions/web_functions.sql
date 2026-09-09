-- ============================================
-- WEB UYGULAMASI İÇİN FONKSİYONLAR
-- Android uygulaması etkilenmez
-- ============================================

-- 1. AKTİF SINIFLARI GETİR
DROP FUNCTION IF EXISTS web_get_active_grades();

CREATE OR REPLACE FUNCTION web_get_active_grades()
RETURNS TABLE (
    id bigint,
    name text,
    order_no integer,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.name,
        g.order_no,
        g.is_active
    FROM 
        public.grades AS g
    WHERE 
        g.is_active = true
    ORDER BY 
        g.order_no ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION web_get_active_grades() TO authenticated;
GRANT EXECUTE ON FUNCTION web_get_active_grades() TO anon;


-- 2. SINIF İÇİN DERSLERİ GETİR
DROP FUNCTION IF EXISTS web_get_lessons_for_grade(bigint);

CREATE OR REPLACE FUNCTION web_get_lessons_for_grade(p_grade_id bigint)
RETURNS TABLE (
    id bigint,
    name text,
    description text,
    icon text,
    is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        l.description,
        l.icon,
        l.is_active
    FROM 
        public.lessons AS l
    JOIN 
        public.lesson_grades AS lg ON l.id = lg.lesson_id
    WHERE 
        lg.grade_id = p_grade_id
        AND lg.is_active = true
        AND l.is_active = true
    ORDER BY 
        l.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION web_get_lessons_for_grade(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION web_get_lessons_for_grade(bigint) TO anon;


-- 3. HAFTANIN KAZANIMLARINI GETİR (WEB VERSİYONU)
DROP FUNCTION IF EXISTS get_week_view_web(bigint, bigint, integer);

CREATE OR REPLACE FUNCTION get_week_view_web(
    p_lesson_id bigint,
    p_grade_id bigint,
    p_week_number integer
)
RETURNS TABLE (
    id bigint,
    topic_id bigint,
    description text,
    unit_title text,
    topic_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.topic_id,
        o.description,
        u.title AS unit_title,
        t.title AS topic_title
    FROM
        public.outcomes AS o
    JOIN
        public.outcome_weeks AS ow ON o.id = ow.outcome_id
    JOIN
        public.topics AS t ON o.topic_id = t.id
    JOIN
        public.units AS u ON t.unit_id = u.id
    JOIN
        public.lesson_grades AS lg ON u.lesson_id = lg.lesson_id
    WHERE
        u.lesson_id = p_lesson_id
        AND lg.grade_id = p_grade_id
        AND p_week_number BETWEEN ow.start_week AND ow.end_week
        AND lg.is_active = true
    ORDER BY
        o.order_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_week_view_web(bigint, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_view_web(bigint, bigint, integer) TO anon;


-- 4. HAFTANIN KONU İÇERİKLERİNİ GETİR (VIDEO YERINE)
-- 2026-09-09'da kaldırıldı: hiçbir web kodu bu fonksiyonu çağırmıyordu (tek çağıran yer,
-- app/src/viewmodels/useDersViewModel.ts, hiçbir yerden import edilmeyen ölü koddu) ve
-- kullandığı public.topic_content_weeks tablosu artık yok (bkz. supabase/migrations/
-- drop_dead_topic_content_weeks_triggers.sql) — çağrılsa zaten hata verirdi.
