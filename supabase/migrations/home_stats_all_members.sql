-- Anasayfadaki sayaç sadece role='student' olan profilleri sayıyordu — kullanıcı artık
-- öğretmen/admin dahil TÜM üyelerin sayısını göstermek istiyor (2026-09-10). Eski
-- get_public_student_count fonksiyonunu, isim de gerçeği yansıtsın diye
-- get_public_member_count olarak değiştiriyoruz (role filtresi kaldırıldı).
DROP FUNCTION IF EXISTS public.get_public_student_count();

CREATE OR REPLACE FUNCTION public.get_public_member_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.profiles;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_member_count() TO anon, authenticated;
