CREATE OR REPLACE FUNCTION get_outcomes_for_week(
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
        public.topics AS t ON o.topic_id = t.id
    JOIN
        public.units AS u ON t.unit_id = u.id
    JOIN
        public.lessons AS l ON u.lesson_id = l.id
    JOIN
        public.lesson_grades AS lg ON l.id = lg.lesson_id
    WHERE
        u.lesson_id = p_lesson_id
        AND lg.grade_id = p_grade_id
        AND o.week_number = p_week_number
        AND lg.is_active = true
    ORDER BY
        o.order_index ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_outcomes_for_week(bigint, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_outcomes_for_week(bigint, bigint, integer) TO anon;
