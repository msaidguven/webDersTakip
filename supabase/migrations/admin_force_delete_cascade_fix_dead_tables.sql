-- admin_force_delete_cascade_fix_sessions.sql'den SONRA çalıştırın.
--
-- protect_student_data_on_delete.sql'in yazıldığı sırada canlıda var sanılan
-- user_curriculum_week_seen_questions / user_unit_seen_questions /
-- user_curriculum_week_run_summary / user_unit_summary / user_weekly_summary
-- tabloları aslında mobil uygulamaya özgüydü ve mobil kaldırılırken (bkz.
-- auto_complete_web_quiz_session_when_answered.sql'deki not) DROP edilmiş — web
-- sitesi bunları hiç okumuyor. admin_force_delete_cascade.sql bu artık var olmayan
-- tablolara DELETE atmaya çalışıyordu, bu yüzden force-delete "relation ... does not
-- exist" ile başarısız oluyordu. Bu iki fonksiyonu, gerçekten var olan tablolarla
-- (test_sessions, test_session_answers, test_session_questions, user_question_stats)
-- sınırlandırıyoruz.

CREATE OR REPLACE FUNCTION public.admin_purge_student_data_for_questions(p_question_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_question_ids IS NULL OR array_length(p_question_ids, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM public.test_session_answers WHERE question_id = ANY(p_question_ids);
  DELETE FROM public.test_session_questions WHERE question_id = ANY(p_question_ids);
  DELETE FROM public.user_question_stats WHERE question_id = ANY(p_question_ids);

  -- Öğrenci yorumları/AI cevapları soruya değil metne bağlı içerik taşıyor —
  -- soruyu silmek yerine sadece bağlantıyı koparıyoruz (kolon nullable).
  UPDATE public.question_comments SET question_id = NULL WHERE question_id = ANY(p_question_ids);
  UPDATE public.rag_answers SET quiz_question_id = NULL WHERE quiz_question_id = ANY(p_question_ids);
  UPDATE public.rag_question_queue SET quiz_question_id = NULL WHERE quiz_question_id = ANY(p_question_ids);
END;
$$;

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_student_data_for_questions(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_purge_student_data_for_units(bigint[]) TO service_role;
