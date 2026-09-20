-- admin_force_delete_cascade.sql'den SONRA çalıştırın.
--
-- Gerçek hata: bir test_sessions satırı genelde birden fazla üniteden soru içerebiliyor
-- (test_sessions.question_ids serbest bir dizi, unit_id sadece "hangi ünite için
-- başlatıldı" bilgisini taşıyor). admin_purge_student_data_for_units doğrudan
-- "DELETE FROM test_sessions WHERE unit_id = ..." yapıyordu, ama o session'a bağlı
-- test_session_answers/test_session_questions satırları (FK: test_session_id, hâlâ
-- ON DELETE NO ACTION) hâlâ dururken bu foreign_key_violation'a çarpıyordu — force
-- delete'in "Zorla silme başarısız" ile başarısız olmasının sebebi buydu.
--
-- Düzeltme: test_sessions'ı silmeden önce, o session'lara bağlı TÜM answers/questions
-- satırlarını (sadece bu ünitenin sorularına ait olanları değil) önce temizliyoruz.

CREATE OR REPLACE FUNCTION public.admin_purge_student_data_for_units(p_unit_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_ids bigint[];
BEGIN
  IF p_unit_ids IS NULL OR array_length(p_unit_ids, 1) IS NULL THEN RETURN; END IF;

  SELECT array_agg(id) INTO v_session_ids FROM public.test_sessions WHERE unit_id = ANY(p_unit_ids);
  IF v_session_ids IS NOT NULL THEN
    DELETE FROM public.test_session_answers WHERE test_session_id = ANY(v_session_ids);
    DELETE FROM public.test_session_questions WHERE test_session_id = ANY(v_session_ids);
  END IF;
  DELETE FROM public.test_sessions WHERE unit_id = ANY(p_unit_ids);

  DELETE FROM public.user_curriculum_week_seen_questions WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_unit_seen_questions WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_curriculum_week_run_summary WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_unit_summary WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_weekly_summary WHERE unit_id = ANY(p_unit_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_student_data_for_units(bigint[]) TO service_role;
