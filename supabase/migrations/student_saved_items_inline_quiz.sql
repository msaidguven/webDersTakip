-- Profil Çalışma Akışı (Study Feed) — Doğrudan Soru Çözme + SRS + Klasik Örnek Cevap
--
-- 1) get_public_saved_items ve get_my_saved_items RPC'leri, kind = 'question' kayıtları için
--    question_payload (soru metni, şıklar, çözüm açıklaması, klasik örnek cevap, izleyicinin
--    mevcut SRS durumu ve son seçtiği şık) döndürür.
-- 2) submit_profile_question_answer RPC'si:
--    - Giriş yapmış kullanıcı şık seçtiğinde doğruluğu SUNUCUDA hesaplar.
--    - user_question_stats.next_review_at > now() ise (tekrar zamanı henüz gelmemişse)
--      yeni test_session_answers satırı yazmaz (çift sayım / puan kasma koruması).
--    - İlk kez çözüyorsa veya tekrar zamanı geldiyse (next_review_at <= now()), 1 soruluk
--      test_sessions + test_session_questions + test_session_answers kaydı açar; mevcut
--      trg_sync_user_question_stats_on_answer ve auto_complete_web_quiz_session trigger'ları
--      SRS'i (user_question_stats), günlük soru sayısını, seriyi ve oturum kapanışını
--      otomatik günceller.

DROP FUNCTION IF EXISTS public.get_public_saved_items(text);

CREATE OR REPLACE FUNCTION public.get_public_saved_items(p_slug text)
RETURNS TABLE (
  id bigint,
  kind text,
  grade_name text,
  lesson_name text,
  unit_title text,
  topic_title text,
  section_heading text,
  excerpt text,
  href text,
  is_public boolean,
  created_at timestamp with time zone,
  question_payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_viewer uuid := auth.uid();
  v_target uuid;
  v_is_owner boolean := false;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[A-Za-z0-9]{12}$' THEN
    RETURN;
  END IF;

  SELECT p.id INTO v_target
  FROM public.profiles p
  WHERE p.public_slug = p_slug
    AND NOT p.is_banned
    AND p.role IN ('student', 'admin')
    AND (p.public_profile OR (v_viewer IS NOT NULL AND p.id = v_viewer));

  IF v_target IS NULL THEN
    RETURN;
  END IF;

  v_is_owner := (v_viewer IS NOT NULL AND v_viewer = v_target);

  RETURN QUERY
  SELECT
    s.id,
    s.kind,
    g.name AS grade_name,
    l.name AS lesson_name,
    u.title AS unit_title,
    t.title AS topic_title,
    s.section_heading,
    CASE
      WHEN s.kind = 'question' THEN COALESCE(s.excerpt, left(regexp_replace(COALESCE(q.question_text, ''), '\*+', '', 'g'), 280))
      ELSE s.excerpt
    END AS excerpt,
    CASE
      WHEN s.kind = 'question' THEN
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/soru-bankasi/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug || '?soru=' || s.question_id
          ELSE '/soru/' || s.question_id
        END
      ELSE
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug
                 || CASE WHEN s.section_anchor IS NOT NULL AND s.section_anchor <> '' THEN '#' || s.section_anchor ELSE '' END
          ELSE '/ders'
        END
    END AS href,
    s.is_public,
    s.created_at,
    CASE
      WHEN s.kind = 'question' AND q.id IS NOT NULL THEN
        jsonb_build_object(
          'question_id', q.id,
          'question_type',
            CASE
              WHEN q.svg_content IS NOT NULL THEN 'other'
              WHEN q.question_type_id IN (1, 2) AND EXISTS (
                SELECT 1 FROM public.question_choices qc WHERE qc.question_id = q.id
              ) THEN 'multiple_choice'
              WHEN q.question_type_id = 3 AND position('_____' in COALESCE(q.question_text, '')) > 0 AND EXISTS (
                SELECT 1 FROM public.question_blank_options qbo WHERE qbo.question_id = q.id
              ) THEN 'blank'
              WHEN q.question_type_id = 4 THEN 'classical'
              ELSE 'other'
            END,
          'question_text', q.question_text,
          'passage', qp.body,
          'solution_text', q.solution_text,
          'model_answer', qcl.model_answer,
          'choices',
            CASE
              WHEN q.svg_content IS NOT NULL THEN '[]'::jsonb
              WHEN q.question_type_id IN (1, 2) THEN COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', qc.id,
                      'text', qc.choice_text,
                      'is_correct', qc.is_correct
                    )
                    ORDER BY qc.id
                  )
                  FROM public.question_choices qc
                  WHERE qc.question_id = q.id
                ),
                '[]'::jsonb
              )
              WHEN q.question_type_id = 3 AND position('_____' in COALESCE(q.question_text, '')) > 0 THEN COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', qbo.id,
                      'text', qbo.option_text,
                      'is_correct', qbo.is_correct
                    )
                    ORDER BY qbo.order_no, qbo.id
                  )
                  FROM public.question_blank_options qbo
                  WHERE qbo.question_id = q.id
                ),
                '[]'::jsonb
              )
              ELSE '[]'::jsonb
            END,
          'srs',
            CASE
              WHEN v_viewer IS NOT NULL AND uqs.question_id IS NOT NULL THEN
                jsonb_build_object(
                  'last_answer_correct', uqs.last_answer_correct,
                  'last_answer_at', uqs.last_answer_at,
                  'next_review_at', uqs.next_review_at,
                  'selected_option_id', last_ans.selected_option_id
                )
              ELSE NULL
            END
        )
      ELSE NULL
    END AS question_payload
  FROM public.student_saved_items s
  LEFT JOIN public.questions q ON q.id = s.question_id AND q.is_active = true
  LEFT JOIN public.question_passages qp ON qp.id = q.passage_id
  LEFT JOIN public.question_classical qcl ON qcl.question_id = q.id
  LEFT JOIN public.topics t ON t.id = COALESCE(s.topic_id, q.topic_id)
  LEFT JOIN public.units u ON u.id = t.unit_id
  LEFT JOIN public.lessons l ON l.id = u.lesson_id
  LEFT JOIN public.grades g ON g.id = u.grade_id
  LEFT JOIN LATERAL (
    SELECT st.question_id, st.last_answer_correct, st.last_answer_at, st.next_review_at
    FROM public.user_question_stats st
    WHERE v_viewer IS NOT NULL
      AND s.kind = 'question'
      AND q.id IS NOT NULL
      AND st.user_id = v_viewer
      AND st.question_id = q.id
    ORDER BY st.last_answer_at DESC NULLS LAST
    LIMIT 1
  ) uqs ON true
  LEFT JOIN LATERAL (
    SELECT a.selected_option_id
    FROM public.test_session_answers a
    WHERE v_viewer IS NOT NULL
      AND s.kind = 'question'
      AND q.id IS NOT NULL
      AND a.user_id = v_viewer
      AND a.question_id = q.id
    ORDER BY a.created_at DESC
    LIMIT 1
  ) last_ans ON true
  WHERE s.user_id = v_target
    AND (v_is_owner OR s.is_public = true)
  ORDER BY s.created_at DESC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_saved_items(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_saved_items(text) TO anon, authenticated;

-- Kendi profil sayfası (/profil) için aynı zengin soru payload'ıyla kayıtlı öğeler
DROP FUNCTION IF EXISTS public.get_my_saved_items();

CREATE OR REPLACE FUNCTION public.get_my_saved_items()
RETURNS TABLE (
  id bigint,
  kind text,
  grade_name text,
  lesson_name text,
  unit_title text,
  topic_title text,
  section_heading text,
  excerpt text,
  href text,
  is_public boolean,
  created_at timestamp with time zone,
  question_payload jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.kind,
    g.name AS grade_name,
    l.name AS lesson_name,
    u.title AS unit_title,
    t.title AS topic_title,
    s.section_heading,
    CASE
      WHEN s.kind = 'question' THEN COALESCE(s.excerpt, left(regexp_replace(COALESCE(q.question_text, ''), '\*+', '', 'g'), 280))
      ELSE s.excerpt
    END AS excerpt,
    CASE
      WHEN s.kind = 'question' THEN
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/soru-bankasi/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug || '?soru=' || s.question_id
          ELSE '/soru/' || s.question_id
        END
      ELSE
        CASE
          WHEN g.slug IS NOT NULL AND l.slug IS NOT NULL AND u.slug IS NOT NULL AND t.slug IS NOT NULL
            THEN '/' || g.slug || '/' || l.slug || '/' || u.slug || '/' || t.slug
                 || CASE WHEN s.section_anchor IS NOT NULL AND s.section_anchor <> '' THEN '#' || s.section_anchor ELSE '' END
          ELSE '/ders'
        END
    END AS href,
    s.is_public,
    s.created_at,
    CASE
      WHEN s.kind = 'question' AND q.id IS NOT NULL THEN
        jsonb_build_object(
          'question_id', q.id,
          'question_type',
            CASE
              WHEN q.svg_content IS NOT NULL THEN 'other'
              WHEN q.question_type_id IN (1, 2) AND EXISTS (
                SELECT 1 FROM public.question_choices qc WHERE qc.question_id = q.id
              ) THEN 'multiple_choice'
              WHEN q.question_type_id = 3 AND position('_____' in COALESCE(q.question_text, '')) > 0 AND EXISTS (
                SELECT 1 FROM public.question_blank_options qbo WHERE qbo.question_id = q.id
              ) THEN 'blank'
              WHEN q.question_type_id = 4 THEN 'classical'
              ELSE 'other'
            END,
          'question_text', q.question_text,
          'passage', qp.body,
          'solution_text', q.solution_text,
          'model_answer', qcl.model_answer,
          'choices',
            CASE
              WHEN q.svg_content IS NOT NULL THEN '[]'::jsonb
              WHEN q.question_type_id IN (1, 2) THEN COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', qc.id,
                      'text', qc.choice_text,
                      'is_correct', qc.is_correct
                    )
                    ORDER BY qc.id
                  )
                  FROM public.question_choices qc
                  WHERE qc.question_id = q.id
                ),
                '[]'::jsonb
              )
              WHEN q.question_type_id = 3 AND position('_____' in COALESCE(q.question_text, '')) > 0 THEN COALESCE(
                (
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'id', qbo.id,
                      'text', qbo.option_text,
                      'is_correct', qbo.is_correct
                    )
                    ORDER BY qbo.order_no, qbo.id
                  )
                  FROM public.question_blank_options qbo
                  WHERE qbo.question_id = q.id
                ),
                '[]'::jsonb
              )
              ELSE '[]'::jsonb
            END,
          'srs',
            CASE
              WHEN uqs.question_id IS NOT NULL THEN
                jsonb_build_object(
                  'last_answer_correct', uqs.last_answer_correct,
                  'last_answer_at', uqs.last_answer_at,
                  'next_review_at', uqs.next_review_at,
                  'selected_option_id', last_ans.selected_option_id
                )
              ELSE NULL
            END
        )
      ELSE NULL
    END AS question_payload
  FROM public.student_saved_items s
  LEFT JOIN public.questions q ON q.id = s.question_id AND q.is_active = true
  LEFT JOIN public.question_passages qp ON qp.id = q.passage_id
  LEFT JOIN public.question_classical qcl ON qcl.question_id = q.id
  LEFT JOIN public.topics t ON t.id = COALESCE(s.topic_id, q.topic_id)
  LEFT JOIN public.units u ON u.id = t.unit_id
  LEFT JOIN public.lessons l ON l.id = u.lesson_id
  LEFT JOIN public.grades g ON g.id = u.grade_id
  LEFT JOIN LATERAL (
    SELECT st.question_id, st.last_answer_correct, st.last_answer_at, st.next_review_at
    FROM public.user_question_stats st
    WHERE s.kind = 'question'
      AND q.id IS NOT NULL
      AND st.user_id = v_user
      AND st.question_id = q.id
    ORDER BY st.last_answer_at DESC NULLS LAST
    LIMIT 1
  ) uqs ON true
  LEFT JOIN LATERAL (
    SELECT a.selected_option_id
    FROM public.test_session_answers a
    WHERE s.kind = 'question'
      AND q.id IS NOT NULL
      AND a.user_id = v_user
      AND a.question_id = q.id
    ORDER BY a.created_at DESC
    LIMIT 1
  ) last_ans ON true
  WHERE s.user_id = v_user
  ORDER BY s.created_at DESC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_saved_items() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_saved_items() TO authenticated;

-- 3) Profil akışından doğrudan soru çözme RPC'si (SRS uyumlu, sunucu doğrulamalı)
CREATE OR REPLACE FUNCTION public.submit_profile_question_answer(
  p_question_id bigint,
  p_selected_option_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_type int;
  v_topic_id bigint;
  v_unit_id bigint;
  v_lesson_id bigint;
  v_grade_id bigint;
  v_correct boolean := false;
  v_correct_option_id bigint;
  v_existing_next_review timestamptz;
  v_existing_correct boolean;
  v_existing_last_at timestamptz;
  v_session_id bigint;
  v_new_next_review timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Giriş gerekli' USING ERRCODE = '28000';
  END IF;

  IF p_question_id IS NULL OR p_selected_option_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz istek' USING ERRCODE = '22P02';
  END IF;

  SELECT q.question_type_id, q.topic_id, t.unit_id, u.lesson_id, u.grade_id
    INTO v_type, v_topic_id, v_unit_id, v_lesson_id, v_grade_id
  FROM public.questions q
  JOIN public.topics t ON t.id = q.topic_id
  JOIN public.units u ON u.id = t.unit_id
  WHERE q.id = p_question_id
    AND q.is_active = true;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Soru bulunamadı' USING ERRCODE = 'P0002';
  END IF;

  -- Doğruluğu SUNUCUDA hesapla
  IF v_type IN (1, 2) THEN
    SELECT c.is_correct INTO v_correct
    FROM public.question_choices c
    WHERE c.id = p_selected_option_id AND c.question_id = p_question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Şık soruya ait değil' USING ERRCODE = '22P02';
    END IF;
    SELECT c.id INTO v_correct_option_id
    FROM public.question_choices c
    WHERE c.question_id = p_question_id AND c.is_correct = true
    ORDER BY c.id
    LIMIT 1;
  ELSIF v_type = 3 THEN
    SELECT o.is_correct INTO v_correct
    FROM public.question_blank_options o
    WHERE o.id = p_selected_option_id AND o.question_id = p_question_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Seçenek soruya ait değil' USING ERRCODE = '22P02';
    END IF;
    SELECT o.id INTO v_correct_option_id
    FROM public.question_blank_options o
    WHERE o.question_id = p_question_id AND o.is_correct = true
    ORDER BY o.order_no, o.id
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Bu soru türü profil akışında çözülemez' USING ERRCODE = '22P02';
  END IF;

  -- SRS kontrolü: tekrar zamanı henüz gelmemişse istatistiğe ve günlük sayıya tekrar yazma
  SELECT st.next_review_at, st.last_answer_correct, st.last_answer_at
    INTO v_existing_next_review, v_existing_correct, v_existing_last_at
  FROM public.user_question_stats st
  WHERE st.user_id = v_user
    AND st.question_id = p_question_id
  ORDER BY st.last_answer_at DESC NULLS LAST
  LIMIT 1;

  IF v_existing_next_review IS NOT NULL AND v_existing_next_review > now() THEN
    RETURN jsonb_build_object(
      'recorded', false,
      'reason', 'not_due',
      'is_correct', COALESCE(v_existing_correct, v_correct),
      'correct_option_id', v_correct_option_id,
      'next_review_at', v_existing_next_review,
      'last_answer_at', v_existing_last_at
    );
  END IF;

  -- İlk çözüm veya SRS tekrar zamanı geldi: 1 soruluk oturum + cevap kaydı
  -- Mevcut trigger'lar user_question_stats (SRS) ve oturum kapanışını otomatik işler;
  -- günlük istatistik, seri ve haftalık sıralama test_session_answers'tan otomatik hesaplanır.
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
    v_user,
    v_unit_id,
    v_lesson_id,
    v_grade_id,
    gen_random_uuid(),
    ARRAY[p_question_id],
    jsonb_build_object('type', 'profile_feed', 'topic_id', v_topic_id)
  )
  RETURNING id INTO v_session_id;

  INSERT INTO public.test_session_questions (test_session_id, question_id, order_no)
  VALUES (v_session_id, p_question_id, 1);

  INSERT INTO public.test_session_answers (
    test_session_id,
    question_id,
    user_id,
    client_id,
    selected_option_id,
    is_correct,
    duration_seconds
  )
  VALUES (
    v_session_id,
    p_question_id,
    v_user,
    gen_random_uuid(),
    p_selected_option_id,
    COALESCE(v_correct, false),
    0
  )
  ON CONFLICT (test_session_id, question_id) DO NOTHING;

  SELECT st.next_review_at
    INTO v_new_next_review
  FROM public.user_question_stats st
  WHERE st.user_id = v_user
    AND st.question_id = p_question_id
  ORDER BY st.last_answer_at DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'recorded', true,
    'reason', NULL,
    'is_correct', COALESCE(v_correct, false),
    'correct_option_id', v_correct_option_id,
    'next_review_at', v_new_next_review,
    'last_answer_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_profile_question_answer(bigint, bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_profile_question_answer(bigint, bigint) TO authenticated;
