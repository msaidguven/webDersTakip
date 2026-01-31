-- Tekil sınıf detayı getirme (aktif/pasif fark etmeksizin)
CREATE OR REPLACE FUNCTION get_grade_by_id(grade_id bigint)
RETURNS TABLE (
    id bigint,
    name text,
    order_no integer,
    is_active boolean,
    question_count integer
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
        g.is_active,
        g.question_count
    FROM public.grades g
    WHERE g.id = grade_id
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_grade_by_id(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_grade_by_id(bigint) TO anon;
