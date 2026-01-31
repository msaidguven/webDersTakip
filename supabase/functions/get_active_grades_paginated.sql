-- Aktif sınıfları sayfalama ile listeleme fonksiyonu (opsiyonel)
CREATE OR REPLACE FUNCTION get_active_grades_paginated(
    page_size integer DEFAULT 10,
    page_offset integer DEFAULT 0
)
RETURNS TABLE (
    id bigint,
    name text,
    order_no integer,
    question_count integer,
    total_count bigint
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
        g.question_count,
        (SELECT COUNT(*) FROM public.grades WHERE is_active = true) as total_count
    FROM public.grades g
    WHERE g.is_active = true
    ORDER BY g.order_no ASC
    LIMIT page_size
    OFFSET page_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_active_grades_paginated(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_grades_paginated(integer, integer) TO anon;
