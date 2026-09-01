-- Fix: the academic_year section of update_user_time_based_stats_on_test_complete
-- picked ONE arbitrary answer from the session (SELECT ... LIMIT 1, no ORDER BY)
-- and attributed the whole session's question/correct/wrong counts to that one
-- answer's academic year. If a session's answers ever spanned an academic-year
-- boundary (summer break rollover), some answers would be misattributed to the
-- wrong academic year. Now grouped per-answer by its own created_at, exactly
-- like the daily/weekly/monthly sections already do above it.

CREATE OR REPLACE FUNCTION public.update_user_time_based_stats_on_test_complete(p_test_session_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    /* ================= DAILY ================= */
    INSERT INTO user_time_based_stats (
        user_id,
        period_type,
        period_date,
        period_value,
        total_questions,
        correct_answers,
        wrong_answers,
        total_duration_seconds
    )
    SELECT
        a.user_id,
        'daily',
        a.created_at::date,
        a.created_at::date::text,
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id, a.created_at::date
    ON CONFLICT (user_id, period_type, period_date)
    DO UPDATE SET
        total_questions        = user_time_based_stats.total_questions + EXCLUDED.total_questions,
        correct_answers        = user_time_based_stats.correct_answers + EXCLUDED.correct_answers,
        wrong_answers          = user_time_based_stats.wrong_answers + EXCLUDED.wrong_answers,
        total_duration_seconds = user_time_based_stats.total_duration_seconds + EXCLUDED.total_duration_seconds,
        last_updated_at        = now();

    /* ================= WEEKLY ================= */
    INSERT INTO user_time_based_stats (
        user_id,
        period_type,
        period_date,
        period_value,
        total_questions,
        correct_answers,
        wrong_answers,
        total_duration_seconds
    )
    SELECT
        a.user_id,
        'weekly',
        date_trunc('week', a.created_at)::date,
        to_char(date_trunc('week', a.created_at), 'IYYY-IW'),
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id, date_trunc('week', a.created_at)
    ON CONFLICT (user_id, period_type, period_date)
    DO UPDATE SET
        total_questions        = user_time_based_stats.total_questions + EXCLUDED.total_questions,
        correct_answers        = user_time_based_stats.correct_answers + EXCLUDED.correct_answers,
        wrong_answers          = user_time_based_stats.wrong_answers + EXCLUDED.wrong_answers,
        total_duration_seconds = user_time_based_stats.total_duration_seconds + EXCLUDED.total_duration_seconds,
        last_updated_at        = now();

    /* ================= MONTHLY ================= */
    INSERT INTO user_time_based_stats (
        user_id,
        period_type,
        period_date,
        period_value,
        total_questions,
        correct_answers,
        wrong_answers,
        total_duration_seconds
    )
    SELECT
        a.user_id,
        'monthly',
        date_trunc('month', a.created_at)::date,
        to_char(date_trunc('month', a.created_at), 'YYYY-MM'),
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id, date_trunc('month', a.created_at)
    ON CONFLICT (user_id, period_type, period_date)
    DO UPDATE SET
        total_questions        = user_time_based_stats.total_questions + EXCLUDED.total_questions,
        correct_answers        = user_time_based_stats.correct_answers + EXCLUDED.correct_answers,
        wrong_answers          = user_time_based_stats.wrong_answers + EXCLUDED.wrong_answers,
        total_duration_seconds = user_time_based_stats.total_duration_seconds + EXCLUDED.total_duration_seconds,
        last_updated_at        = now();

    /* ================= ACADEMIC YEAR ================= */
    -- Grouped per-answer by its own date (like daily/weekly/monthly above),
    -- instead of picking one arbitrary answer's academic year for the whole
    -- session (previous LIMIT 1 approach).
    INSERT INTO user_time_based_stats (
        user_id,
        period_type,
        period_date,
        period_value,
        total_questions,
        correct_answers,
        wrong_answers,
        total_duration_seconds
    )
    SELECT
        a.user_id,
        'academic_year',
        get_academic_year_start(a.created_at::date),
        get_academic_year_label(a.created_at::date),
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id, get_academic_year_start(a.created_at::date), get_academic_year_label(a.created_at::date)
    ON CONFLICT (user_id, period_type, period_date)
    DO UPDATE SET
        total_questions        = user_time_based_stats.total_questions + EXCLUDED.total_questions,
        correct_answers        = user_time_based_stats.correct_answers + EXCLUDED.correct_answers,
        wrong_answers          = user_time_based_stats.wrong_answers + EXCLUDED.wrong_answers,
        total_duration_seconds = user_time_based_stats.total_duration_seconds + EXCLUDED.total_duration_seconds,
        last_updated_at        = now();

END;
$function$;
