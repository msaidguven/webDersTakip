-- admin_cascade_delete.sql + protect_student_data_on_delete.sql'den SONRA çalıştırın.
--
-- protect_student_data_on_delete.sql ile öğrenci geçmişi tablolarına (test_sessions,
-- test_session_answers/questions, user_question_stats, user_*_seen_questions,
-- user_*_summary) bilinçli olarak ON DELETE NO ACTION konmuştu — admin normal "Sil"
-- akışında bir ünite/konu/soru öğrenci tarafından kullanılmışsa hiçbir şey silinmeden
-- foreign_key_violation dönüyor (bkz. admin_delete_*_cascade). Bu doğru ve KORUNUYOR.
--
-- Ama toplu-sil admin sayfasında ("Tüm Üniteleri Sil" vb.) admin bazen bunu bilerek
-- isteyebiliyor (ör. test verisiyle doldurulmuş bir sınıfı tamamen temizlemek). Bunun
-- için AYRI, sadece "force" onay kutusuyla tetiklenen bir ikinci fonksiyon seti:
-- admin_force_delete_{units,topics,questions}_cascade. Bunlar önce ilgili öğrenci
-- geçmişi satırlarını (ve o ünite/konuya bağlı RAG/AI içerik tablolarını) açıkça
-- siliyor/bağlantısını koparıyor, sonra asıl satırı siliyor. Normal admin_delete_*
-- fonksiyonları DEĞİŞMEDİ — varsayılan silme hâlâ öğrenci geçmişini korumaya devam
-- ediyor, force sadece admin açıkça isteyince kullanılıyor.

-- ── Yardımcı: bir soru kümesine bağlı öğrenci geçmişini temizle ────────────────────
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
  DELETE FROM public.user_curriculum_week_seen_questions WHERE question_id = ANY(p_question_ids);
  DELETE FROM public.user_unit_seen_questions WHERE question_id = ANY(p_question_ids);

  -- Öğrenci yorumları/AI cevapları soruya değil metne bağlı içerik taşıyor —
  -- soruyu silmek yerine sadece bağlantıyı koparıyoruz (kolon nullable).
  UPDATE public.question_comments SET question_id = NULL WHERE question_id = ANY(p_question_ids);
  UPDATE public.rag_answers SET quiz_question_id = NULL WHERE quiz_question_id = ANY(p_question_ids);
  UPDATE public.rag_question_queue SET quiz_question_id = NULL WHERE quiz_question_id = ANY(p_question_ids);
END;
$$;

-- ── Yardımcı: bir ünite kümesine bağlı öğrenci geçmişini temizle ───────────────────
CREATE OR REPLACE FUNCTION public.admin_purge_student_data_for_units(p_unit_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_unit_ids IS NULL OR array_length(p_unit_ids, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM public.test_sessions WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_curriculum_week_seen_questions WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_unit_seen_questions WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_curriculum_week_run_summary WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_unit_summary WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.user_weekly_summary WHERE unit_id = ANY(p_unit_ids);
END;
$$;

-- ── Yardımcı: bir konu kümesine bağlı AI/RAG üretim içeriğini temizle ──────────────
CREATE OR REPLACE FUNCTION public.admin_purge_ai_content_for_topics(p_topic_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_topic_ids IS NULL OR array_length(p_topic_ids, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM public.ai_question_drafts WHERE topic_id = ANY(p_topic_ids);
  DELETE FROM public.topic_section_content_drafts WHERE topic_id = ANY(p_topic_ids);
  DELETE FROM public.rag_topic_review_flags WHERE topic_id = ANY(p_topic_ids);
  DELETE FROM public.topic_teacher_guide_notes WHERE topic_id = ANY(p_topic_ids);
  DELETE FROM public.rag_documents WHERE topic_id = ANY(p_topic_ids);

  UPDATE public.question_comments SET topic_id = NULL WHERE topic_id = ANY(p_topic_ids);
  UPDATE public.rag_answers SET topic_id = NULL WHERE topic_id = ANY(p_topic_ids);
  UPDATE public.rag_question_queue SET topic_id = NULL WHERE topic_id = ANY(p_topic_ids);
END;
$$;

-- ── Yardımcı: bir ünite kümesine bağlı AI/RAG üretim içeriğini temizle ─────────────
CREATE OR REPLACE FUNCTION public.admin_purge_ai_content_for_units(p_unit_ids bigint[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_unit_ids IS NULL OR array_length(p_unit_ids, 1) IS NULL THEN RETURN; END IF;

  DELETE FROM public.teacher_guide_documents WHERE unit_id = ANY(p_unit_ids);
  DELETE FROM public.rag_documents WHERE unit_id = ANY(p_unit_ids);

  UPDATE public.question_comments SET unit_id = NULL WHERE unit_id = ANY(p_unit_ids);
  UPDATE public.rag_answers SET unit_id = NULL WHERE unit_id = ANY(p_unit_ids);
  UPDATE public.rag_question_queue SET unit_id = NULL WHERE unit_id = ANY(p_unit_ids);
END;
$$;

-- ── Asıl force-delete fonksiyonları ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_force_delete_questions_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      PERFORM public.admin_purge_student_data_for_questions(ARRAY[v_id]);
      DELETE FROM public.questions WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      item_id := v_id; success := false; reason := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_delete_topics_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_question_ids bigint[];
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      SELECT array_agg(id) INTO v_question_ids FROM public.questions WHERE topic_id = v_id;
      PERFORM public.admin_purge_student_data_for_questions(v_question_ids);
      PERFORM public.admin_purge_ai_content_for_topics(ARRAY[v_id]);
      DELETE FROM public.topics WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      item_id := v_id; success := false; reason := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_delete_units_cascade(p_ids bigint[])
RETURNS TABLE(item_id bigint, success boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
  v_topic_ids bigint[];
  v_question_ids bigint[];
BEGIN
  FOREACH v_id IN ARRAY p_ids LOOP
    BEGIN
      SELECT array_agg(id) INTO v_topic_ids FROM public.topics WHERE unit_id = v_id;
      SELECT array_agg(q.id) INTO v_question_ids FROM public.questions q WHERE q.topic_id = ANY(COALESCE(v_topic_ids, ARRAY[]::bigint[]));

      PERFORM public.admin_purge_student_data_for_questions(v_question_ids);
      PERFORM public.admin_purge_ai_content_for_topics(v_topic_ids);
      PERFORM public.admin_purge_student_data_for_units(ARRAY[v_id]);
      PERFORM public.admin_purge_ai_content_for_units(ARRAY[v_id]);

      DELETE FROM public.units WHERE id = v_id;
      item_id := v_id; success := true; reason := NULL;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      item_id := v_id; success := false; reason := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_purge_student_data_for_questions(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_purge_student_data_for_units(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_purge_ai_content_for_topics(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_purge_ai_content_for_units(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_questions_cascade(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_topics_cascade(bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_units_cascade(bigint[]) TO service_role;
