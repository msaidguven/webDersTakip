-- settings->>'type' was hardcoded to the meaningless 'web_quiz' for every session created
-- from the website, whether it was a unit test or a topic comprehension test. Match the
-- mobile app's convention instead: 'unit_test' when there's no topic_id (ünite testi),
-- 'topic_test' when there is (konu kavrama testi). findResumableSession() itself keys off
-- settings->>'topic_id' (unchanged), so this doesn't change resume behavior — it's purely
-- so the stored data is actually meaningful when inspected/queried.

CREATE OR REPLACE FUNCTION public.start_web_quiz_session(
  p_client_id uuid,
  p_grade_id bigint,
  p_lesson_id bigint,
  p_unit_id bigint,
  p_topic_id bigint,
  p_question_ids bigint[]
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_session_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_question_ids IS NULL OR array_length(p_question_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.test_sessions (
    user_id,
    unit_id,
    lesson_id,
    grade_id,
    client_id,
    question_ids,
    settings
  )
  VALUES (
    auth.uid(),
    p_unit_id,
    p_lesson_id,
    p_grade_id,
    p_client_id,
    p_question_ids,
    jsonb_build_object(
      'type', CASE WHEN p_topic_id IS NULL THEN 'unit_test' ELSE 'topic_test' END,
      'topic_id', p_topic_id
    )
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.test_session_questions (test_session_id, question_id, order_no)
  SELECT
    v_session_id,
    q.question_id,
    q.ord::integer
  FROM unnest(p_question_ids) WITH ORDINALITY AS q(question_id, ord);

  RETURN v_session_id;
END;
$function$;
