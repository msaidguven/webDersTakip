-- Test cevaplarının güvenliği — 1. KISIM: yalnız EKLER (2026-10-08, bölündü 2026-10-10).
-- Açıklama ve gerekçe: secure_test_answers_2_lockdown.sql başı.
--
-- HEMEN çalıştırılabilir: yeni submit_test_answers RPC'sini ekler, search_path'leri sabitler.
-- Hiçbir izni kaldırmaz → canlıdaki eski kod (doğrudan tabloya yazan) çalışmaya devam eder.
-- SIRA: 1) bu dosya  2) yeni web kodu canlıya  3) secure_test_answers_2_lockdown.sql
-- Böylece hiçbir anda cevap kaydı aksamaz.

-- ── 1) Cevap kaydı ──────────────────────────────────────────────────────────

-- p_rows: [{test_session_id, question_id, client_id, selected_option_id, match, duration_seconds}]
--   selected_option_id: çoktan seçmeli/doğru-yanlışta question_choices.id, boşlukta question_blank_options.id
--   match: eşleştirmede {"<sol çift id>": <seçilen sağ çift id>}; doğru = her çift kendisiyle eşleşmiş
-- Dönüş: {"inserted": n, "skipped": [{test_session_id, question_id, reason}]}.
-- İdempotent: (test_session_id, question_id) benzersiz. Geçersiz satır partiyi bozmaz, atlanır.
CREATE OR REPLACE FUNCTION public.submit_test_answers(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row jsonb;
  v_session test_sessions;
  v_question bigint;
  v_option bigint;
  v_match jsonb;
  v_type int;
  v_correct boolean;
  v_answer_text text;
  v_inserted int := 0;
  v_n int;
  v_skipped jsonb := '[]';
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Giriş gerekli' USING ERRCODE = '28000'; END IF;
  IF jsonb_typeof(p_rows) <> 'array' THEN RAISE EXCEPTION 'Geçersiz istek' USING ERRCODE = '22P02'; END IF;
  IF jsonb_array_length(p_rows) > 200 THEN RAISE EXCEPTION 'Çok fazla cevap' USING ERRCODE = '22P02'; END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_question := (v_row->>'question_id')::bigint;
    v_option := nullif(v_row->>'selected_option_id', '')::bigint;
    v_match := CASE WHEN jsonb_typeof(v_row->'match') = 'object' THEN v_row->'match' END;
    v_answer_text := NULL;

    SELECT * INTO v_session FROM test_sessions
    WHERE id = (v_row->>'test_session_id')::bigint AND user_id = v_user;
    IF v_session.id IS NULL THEN
      v_skipped := v_skipped || jsonb_build_object('test_session_id', v_row->'test_session_id', 'question_id', v_question, 'reason', 'oturum yok');
      CONTINUE;
    END IF;
    IF NOT (v_question = ANY (v_session.question_ids)) THEN
      v_skipped := v_skipped || jsonb_build_object('test_session_id', v_session.id, 'question_id', v_question, 'reason', 'soru oturumda yok');
      CONTINUE;
    END IF;

    SELECT question_type_id INTO v_type FROM questions WHERE id = v_question;
    v_correct := false;
    IF v_type IN (1, 2) THEN                         -- çoktan seçmeli / doğru-yanlış
      IF v_option IS NOT NULL THEN
        SELECT c.is_correct INTO v_correct FROM question_choices c WHERE c.id = v_option AND c.question_id = v_question;
        IF NOT FOUND THEN
          v_skipped := v_skipped || jsonb_build_object('test_session_id', v_session.id, 'question_id', v_question, 'reason', 'şık soruya ait değil');
          CONTINUE;
        END IF;
      END IF;
    ELSIF v_type = 3 THEN                            -- boşluk doldurma (tek seçenek)
      IF v_option IS NOT NULL THEN
        SELECT o.is_correct INTO v_correct FROM question_blank_options o WHERE o.id = v_option AND o.question_id = v_question;
        IF NOT FOUND THEN
          v_skipped := v_skipped || jsonb_build_object('test_session_id', v_session.id, 'question_id', v_question, 'reason', 'seçenek soruya ait değil');
          CONTINUE;
        END IF;
      END IF;
    ELSIF v_type = 5 THEN                            -- eşleştirme
      v_option := NULL;
      IF v_match IS NOT NULL THEN
        v_answer_text := v_match::text;
        -- Doğru: sorunun TÜM çiftleri atanmış, her biri kendisiyle eşleşmiş, fazladan anahtar yok.
        SELECT (SELECT count(*) FROM jsonb_object_keys(v_match)) = count(*)
               AND bool_and((v_match->>p.id::text) IS NOT NULL AND (v_match->>p.id::text)::bigint = p.id)
          INTO v_correct
        FROM question_matching_pairs p WHERE p.question_id = v_question;
        v_correct := coalesce(v_correct, false);
      END IF;
    ELSE                                             -- klasik ve bilinmeyen türler kaydedilmez
      v_skipped := v_skipped || jsonb_build_object('test_session_id', v_session.id, 'question_id', v_question, 'reason', 'desteklenmeyen soru türü');
      CONTINUE;
    END IF;

    INSERT INTO test_session_answers (test_session_id, question_id, user_id, client_id, selected_option_id, answer_text, is_correct, duration_seconds)
    VALUES (v_session.id, v_question, v_user, nullif(v_row->>'client_id', '')::uuid, v_option, v_answer_text, coalesce(v_correct, false),
            least(greatest(coalesce((v_row->>'duration_seconds')::int, 0), 0), 3600))
    ON CONFLICT (test_session_id, question_id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_inserted := v_inserted + v_n;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_test_answers(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_test_answers(jsonb) TO authenticated;

-- ── 6) search_path ──────────────────────────────────────────────────────────

ALTER FUNCTION public.start_web_quiz_session(uuid, bigint, bigint, bigint, bigint, bigint[]) SET search_path = public;
ALTER FUNCTION public.finish_test_session(bigint) SET search_path = public;
ALTER FUNCTION public.auto_complete_web_quiz_session() SET search_path = public;
