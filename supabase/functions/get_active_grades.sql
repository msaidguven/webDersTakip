-- Aktif sınıfları listeleme fonksiyonu
CREATE OR REPLACE FUNCTION get_active_grades()
RETURNS TABLE (
    id bigint,
    name text,
    order_no integer,
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
        g.question_count
    FROM public.grades g
    WHERE g.is_active = true
    ORDER BY g.order_no ASC;
END;
$$;

-- Fonksiyon için execute yetkisi (RLS aktifse gerekli)
GRANT EXECUTE ON FUNCTION get_active_grades() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_grades() TO anon;
