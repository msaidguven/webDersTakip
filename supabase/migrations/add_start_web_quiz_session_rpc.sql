-- Lets the website record a completed web quiz (kavrama-testi / unite-testi)
-- into the existing test_sessions / test_session_answers pipeline, using the
-- exact question set the page already picked (getTopicTestQuestions /
-- getUnitTestQuestions) instead of letting the DB pick its own questions like
-- start_unit_test does. Once this session is finished via finish_test_session,
-- the same process_test_completion orchestrator (SRS stats, daily/weekly
-- rollups, etc.) that the mobile app relies on runs automatically.
--
-- Uses auth.uid() directly (not a client-supplied p_user_id) so a caller can
-- never create a session under another user's id.

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
    jsonb_build_object('type', 'web_quiz', 'topic_id', p_topic_id)
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

GRANT EXECUTE ON FUNCTION public.start_web_quiz_session(uuid, bigint, bigint, bigint, bigint, bigint[]) TO anon, authenticated;
