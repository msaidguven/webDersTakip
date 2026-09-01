-- Fix bugs in rebuild_user_question_stats_for_test:
-- 1. best_streak was hardcoded to 1 on first-ever insert, even when the
--    first answer was wrong (current_streak=0). Now mirrors current_streak.
-- 2. next_review_at tiering for correct answers used the lifetime
--    correct_attempts counter (never resets) instead of current_streak
--    (resets to 0 on a wrong answer), so a user recovering from a wrong
--    answer could still get a 90-day interval based on old history.
--    Now uses current_streak so spacing reflects the current run.
-- 3. is_mastered never reset to false after a wrong answer broke the
--    streak, so "mastered" stayed true forever once reached once.
--    Now resets to false (and mastered_at to NULL) on a wrong answer.

CREATE OR REPLACE FUNCTION public.rebuild_user_question_stats_for_test(p_test_session_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.user_question_stats (
    user_id,
    question_id,
    grade_id,
    last_answer_correct,
    last_answer_at,
    total_attempts,
    correct_attempts,
    wrong_attempts,
    next_review_at,
    created_at,
    updated_at,
    current_streak,
    best_streak,
    is_mastered,
    mastered_at
  )
  SELECT
    a.user_id,
    a.question_id,
    ts.grade_id,
    a.is_correct,
    a.created_at,
    1,
    CASE WHEN a.is_correct THEN 1 ELSE 0 END,
    CASE WHEN a.is_correct THEN 0 ELSE 1 END,
    now() + (
      CASE
        WHEN a.is_correct = false THEN interval '1 day'
        ELSE interval '3 day'
      END
    ),
    now(),
    now(),
    CASE
      WHEN a.is_correct = true THEN 1
      ELSE 0
    END,
    CASE
      WHEN a.is_correct = true THEN 1
      ELSE 0
    END,
    false,
    NULL
  FROM public.test_session_answers a
  JOIN public.test_sessions ts ON ts.id = a.test_session_id
  WHERE a.test_session_id = p_test_session_id
    AND ts.grade_id IS NOT NULL

  ON CONFLICT (user_id, question_id, grade_id)
  DO UPDATE SET
    last_answer_correct = EXCLUDED.last_answer_correct,
    last_answer_at      = EXCLUDED.last_answer_at,
    total_attempts      = user_question_stats.total_attempts + 1,
    correct_attempts    = CASE
                            WHEN EXCLUDED.last_answer_correct
                            THEN user_question_stats.correct_attempts + 1
                            ELSE user_question_stats.correct_attempts
                          END,
    wrong_attempts      = CASE
                            WHEN EXCLUDED.last_answer_correct
                            THEN user_question_stats.wrong_attempts
                            ELSE user_question_stats.wrong_attempts + 1
                          END,
    next_review_at      = now() + (
      CASE
        WHEN EXCLUDED.last_answer_correct = false THEN interval '1 day'
        ELSE
          CASE
            WHEN user_question_stats.current_streak = 0 THEN interval '3 day'
            WHEN user_question_stats.current_streak = 1 THEN interval '7 day'
            WHEN user_question_stats.current_streak = 2 THEN interval '15 days'
            WHEN user_question_stats.current_streak = 3 THEN interval '33 days'
            WHEN user_question_stats.current_streak = 4 THEN interval '60 days'
            ELSE interval '90 days'
          END
      END
    ),
    current_streak = CASE
      WHEN EXCLUDED.last_answer_correct = true
      THEN user_question_stats.current_streak + 1
      ELSE 0
    END,
    best_streak = CASE
      WHEN EXCLUDED.last_answer_correct = true
      THEN GREATEST(
        user_question_stats.best_streak,
        user_question_stats.current_streak + 1
      )
      ELSE user_question_stats.best_streak
    END,
    is_mastered = CASE
      WHEN EXCLUDED.last_answer_correct = true
           AND (user_question_stats.current_streak + 1) >= 3
      THEN true
      WHEN EXCLUDED.last_answer_correct = false
      THEN false
      ELSE user_question_stats.is_mastered
    END,
    mastered_at = CASE
      WHEN user_question_stats.is_mastered = false
           AND EXCLUDED.last_answer_correct = true
           AND (user_question_stats.current_streak + 1) >= 3
      THEN now()
      WHEN EXCLUDED.last_answer_correct = false
      THEN NULL
      ELSE user_question_stats.mastered_at
    END,
    updated_at = now();
END;
$function$;
