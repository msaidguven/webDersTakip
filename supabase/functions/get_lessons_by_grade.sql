CREATE OR REPLACE FUNCTION get_lessons_by_grade(p_grade_id bigint)
RETURNS TABLE (
    id bigint,
    name text,
    description text,
    icon text,
    order_no integer,
    slug text,
    question_count integer
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
        l.order_no,
        l.slug,
        lg.question_count
    FROM public.lessons l
    INNER JOIN public.lesson_grades lg ON l.id = lg.lesson_id
    WHERE lg.grade_id = p_grade_id
      AND lg.is_active = true
    ORDER BY l.order_no ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_lessons_by_grade(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lessons_by_grade(bigint) TO anon;
