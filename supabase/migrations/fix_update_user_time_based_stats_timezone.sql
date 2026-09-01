-- Fix: this function bucketed daily/weekly/monthly/academic_year stats using
-- a.created_at::date, which implicitly converts the timestamptz to a date
-- using the DB SESSION's timezone (UTC on this Supabase project). The app's
-- "today" (todayDateString() in dashboardDate.ts) is computed from the
-- student's LOCAL browser clock (Turkey, UTC+3). Between 00:00-03:00 Turkey
-- time (21:00-00:00 UTC the previous day), a question answered "today" for
-- the student was bucketed into "yesterday" in the DB, making the panel show
-- 0 questions solved even right after finishing a test.
--
-- Fix: convert to Europe/Istanbul before truncating to date/week/month, for
-- every period_type section (daily/weekly/monthly/academic_year).

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
        (a.created_at AT TIME ZONE 'Europe/Istanbul')::date,
        (a.created_at AT TIME ZONE 'Europe/Istanbul')::date::text,
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id, (a.created_at AT TIME ZONE 'Europe/Istanbul')::date
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
        date_trunc('week', a.created_at AT TIME ZONE 'Europe/Istanbul')::date,
        to_char(date_trunc('week', a.created_at AT TIME ZONE 'Europe/Istanbul'), 'IYYY-IW'),
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id, date_trunc('week', a.created_at AT TIME ZONE 'Europe/Istanbul')
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
        date_trunc('month', a.created_at AT TIME ZONE 'Europe/Istanbul')::date,
        to_char(date_trunc('month', a.created_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM'),
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id, date_trunc('month', a.created_at AT TIME ZONE 'Europe/Istanbul')
    ON CONFLICT (user_id, period_type, period_date)
    DO UPDATE SET
        total_questions        = user_time_based_stats.total_questions + EXCLUDED.total_questions,
        correct_answers        = user_time_based_stats.correct_answers + EXCLUDED.correct_answers,
        wrong_answers          = user_time_based_stats.wrong_answers + EXCLUDED.wrong_answers,
        total_duration_seconds = user_time_based_stats.total_duration_seconds + EXCLUDED.total_duration_seconds,
        last_updated_at        = now();

    /* ================= ACADEMIC YEAR ================= */
    -- Grouped per-answer by its own Istanbul-local date (like daily/weekly/monthly).
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
        get_academic_year_start((a.created_at AT TIME ZONE 'Europe/Istanbul')::date),
        get_academic_year_label((a.created_at AT TIME ZONE 'Europe/Istanbul')::date),
        COUNT(*)                               AS total_questions,
        COUNT(*) FILTER (WHERE a.is_correct)   AS correct_answers,
        COUNT(*) FILTER (WHERE NOT a.is_correct) AS wrong_answers,
        COALESCE(SUM(a.duration_seconds), 0)   AS total_duration
    FROM test_session_answers a
    WHERE a.test_session_id = p_test_session_id
    GROUP BY a.user_id,
        get_academic_year_start((a.created_at AT TIME ZONE 'Europe/Istanbul')::date),
        get_academic_year_label((a.created_at AT TIME ZONE 'Europe/Istanbul')::date)
    ON CONFLICT (user_id, period_type, period_date)
    DO UPDATE SET
        total_questions        = user_time_based_stats.total_questions + EXCLUDED.total_questions,
        correct_answers        = user_time_based_stats.correct_answers + EXCLUDED.correct_answers,
        wrong_answers          = user_time_based_stats.wrong_answers + EXCLUDED.wrong_answers,
        total_duration_seconds = user_time_based_stats.total_duration_seconds + EXCLUDED.total_duration_seconds,
        last_updated_at        = now();

END;
$function$;
