-- ============================================
-- HAFTALIK TEST FONKSİYONLARI
-- ============================================

-- 1. HAFTALIK TEST OTURUMU BAŞLAT
DROP FUNCTION IF EXISTS start_weekly_test_session(uuid, bigint, integer, uuid);

CREATE OR REPLACE FUNCTION start_weekly_test_session(
    p_user_id uuid,
    p_unit_id bigint,
    p_curriculum_week integer,
    p_client_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id BIGINT;
    v_question_ids BIGINT[];
    v_lesson_id BIGINT;
    v_grade_id BIGINT;
BEGIN
    -- 1. Bu hafta için zaten aktif bir test var mı diye kontrol et.
    SELECT id
    INTO v_session_id
    FROM public.test_sessions
    WHERE user_id = p_user_id
      AND unit_id = p_unit_id
      AND completed_at IS NULL
      AND settings->>'type' = 'weekly'
      AND (settings->>'curriculum_week')::integer = p_curriculum_week
    LIMIT 1;

    -- Eğer bu hafta için aktif bir oturum bulunduysa, onun ID'sini döndür.
    IF v_session_id IS NOT NULL THEN
        RETURN v_session_id;
    END IF;

    -- 2. O haftaya ait, kullanıcının henüz çözmediği soruları seç.
    SELECT
        ARRAY_AGG(sub.id)
    INTO
        v_question_ids
    FROM (
        SELECT
            q.id
        FROM
            public.questions AS q
        JOIN
            public.question_usages AS qu ON q.id = qu.question_id
        JOIN
            public.topics AS t ON qu.topic_id = t.id
        LEFT JOIN
            public.user_curriculum_week_seen_questions AS uwqp
            ON q.id = uwqp.question_id
            AND uwqp.user_id = p_user_id
            AND uwqp.unit_id = p_unit_id
            AND uwqp.curriculum_week = p_curriculum_week
        WHERE
            t.unit_id = p_unit_id
            AND qu.curriculum_week = p_curriculum_week
            AND uwqp.id IS NULL
        ORDER BY
            RANDOM()
        LIMIT 10
    ) AS sub;

    -- Eğer çözülecek uygun yeni soru bulunamazsa, NULL döndür.
    IF v_question_ids IS NULL OR array_length(v_question_ids, 1) = 0 THEN
        RETURN NULL;
    END IF;

    -- 3. Yeni oturumu oluşturmadan önce lesson_id ve grade_id'yi bul.
    SELECT u.lesson_id, ug.grade_id
    INTO v_lesson_id, v_grade_id
    FROM public.units u
    JOIN public.unit_grades ug ON u.id = ug.unit_id
    WHERE u.id = p_unit_id
    LIMIT 1;

    -- 4. Yeni bir test oturumu oluştur.
    INSERT INTO public.test_sessions (user_id, unit_id, lesson_id, grade_id, client_id, question_ids, settings)
    VALUES (
        p_user_id,
        p_unit_id,
        v_lesson_id,
        v_grade_id,
        p_client_id,
        v_question_ids,
        jsonb_build_object('type', 'weekly', 'curriculum_week', p_curriculum_week)
    )
    RETURNING id INTO v_session_id;

    -- 5. Seçilen soruları test_session_questions tablosuna ekle.
    INSERT INTO public.test_session_questions (test_session_id, question_id, order_no)
    SELECT
        v_session_id,
        question_id,
        row_number() OVER ()
    FROM
        unnest(v_question_ids) AS question_id;

    -- 6. Yeni oturumun ID'sini döndür.
    RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION start_weekly_test_session(uuid, bigint, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION start_weekly_test_session(uuid, bigint, integer, uuid) TO anon;


-- 2. TEST OTURUMUNDAKİ SORULARI GETİR
DROP FUNCTION IF EXISTS get_test_session_questions(bigint);

CREATE OR REPLACE FUNCTION get_test_session_questions(p_session_id bigint)
RETURNS TABLE (
    question_id bigint,
    order_no integer,
    question_text text,
    question_type_id smallint,
    difficulty smallint,
    score smallint,
    choices jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id as question_id,
        tsq.order_no,
        q.question_text,
        q.question_type_id,
        q.difficulty,
        q.score,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', qc.id,
                        'text', qc.choice_text,
                        'is_correct', qc.is_correct
                    ) ORDER BY qc.id
                )
                FROM public.question_choices qc
                WHERE qc.question_id = q.id
            ),
            '[]'::jsonb
        ) as choices
    FROM public.test_session_questions tsq
    JOIN public.questions q ON tsq.question_id = q.id
    WHERE tsq.test_session_id = p_session_id
    ORDER BY tsq.order_no ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_test_session_questions(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_test_session_questions(bigint) TO anon;


-- 3. TEST CEVABINI KAYDET
DROP FUNCTION IF EXISTS submit_test_answer(bigint, bigint, bigint, uuid, bigint, text, boolean, integer);

CREATE OR REPLACE FUNCTION submit_test_answer(
    p_session_id bigint,
    p_question_id bigint,
    p_selected_option_id bigint,
    p_user_id uuid,
    p_client_id uuid,
    p_answer_text text,
    p_is_correct boolean,
    p_duration_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unit_id bigint;
    v_curriculum_week integer;
    v_existing_answer_id bigint;
BEGIN
    -- Test oturum bilgilerini al
    SELECT unit_id, (settings->>'curriculum_week')::integer
    INTO v_unit_id, v_curriculum_week
    FROM public.test_sessions
    WHERE id = p_session_id;

    -- Eğer bu soruya daha önce cevap verilmişse güncelle, yoksa ekle
    SELECT id INTO v_existing_answer_id
    FROM public.test_session_answers
    WHERE test_session_id = p_session_id AND question_id = p_question_id
    LIMIT 1;

    IF v_existing_answer_id IS NOT NULL THEN
        -- Güncelle
        UPDATE public.test_session_answers
        SET 
            selected_option_id = p_selected_option_id,
            user_answer_text = p_answer_text,
            answer_text = p_answer_text,
            is_correct = p_is_correct,
            duration_seconds = p_duration_seconds,
            created_at = now()
        WHERE id = v_existing_answer_id;
    ELSE
        -- Yeni ekle
        INSERT INTO public.test_session_answers (
            test_session_id, question_id, selected_option_id, user_id, 
            client_id, user_answer_text, answer_text, is_correct, duration_seconds
        ) VALUES (
            p_session_id, p_question_id, p_selected_option_id, p_user_id,
            p_client_id, p_answer_text, p_answer_text, p_is_correct, p_duration_seconds
        );
    END IF;

    -- user_curriculum_week_seen_questions tablosuna da ekle (çözülen soru takibi için)
    INSERT INTO public.user_curriculum_week_seen_questions (
        user_id, unit_id, question_id, is_correct, curriculum_week, test_session_id
    ) VALUES (
        p_user_id, v_unit_id, p_question_id, p_is_correct, v_curriculum_week, p_session_id
    )
    ON CONFLICT (user_id, unit_id, question_id, curriculum_week) DO UPDATE
    SET is_correct = p_is_correct, answered_at = now();

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_test_answer(bigint, bigint, bigint, uuid, uuid, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_test_answer(bigint, bigint, bigint, uuid, uuid, text, boolean, integer) TO anon;


-- 4. TEST OTURUMUNU TAMAMLA
DROP FUNCTION IF EXISTS complete_test_session(bigint);

CREATE OR REPLACE FUNCTION complete_test_session(p_session_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.test_sessions
    SET completed_at = now()
    WHERE id = p_session_id AND completed_at IS NULL;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_test_session(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_test_session(bigint) TO anon;


-- 5. TEST SONUÇLARINI GETİR
DROP FUNCTION IF EXISTS get_test_results(bigint);

CREATE OR REPLACE FUNCTION get_test_results(p_session_id bigint)
RETURNS TABLE (
    total_questions integer,
    answered_questions integer,
    correct_count integer,
    wrong_count integer,
    empty_count integer,
    total_score integer,
    earned_score integer,
    percentage integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH question_stats AS (
        SELECT 
            q.id as qid,
            q.score,
            tsa.is_correct,
            tsa.id as answer_id
        FROM public.test_session_questions tsq
        JOIN public.questions q ON tsq.question_id = q.id
        LEFT JOIN public.test_session_answers tsa ON tsq.test_session_id = tsa.test_session_id 
            AND tsq.question_id = tsa.question_id
        WHERE tsq.test_session_id = p_session_id
    )
    SELECT 
        COUNT(*)::integer as total_questions,
        COUNT(answer_id)::integer as answered_questions,
        COUNT(*) FILTER (WHERE is_correct = true)::integer as correct_count,
        COUNT(*) FILTER (WHERE is_correct = false)::integer as wrong_count,
        COUNT(*) FILTER (WHERE answer_id IS NULL)::integer as empty_count,
        COALESCE(SUM(score), 0)::integer as total_score,
        COALESCE(SUM(score) FILTER (WHERE is_correct = true), 0)::integer as earned_score,
        CASE 
            WHEN SUM(score) > 0 THEN 
                ROUND((COALESCE(SUM(score) FILTER (WHERE is_correct = true), 0)::numeric / SUM(score)::numeric) * 100)::integer
            ELSE 0
        END as percentage
    FROM question_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION get_test_results(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_test_results(bigint) TO anon;
