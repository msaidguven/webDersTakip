-- user_question_stats (SRS/ustalik takibi) su ana kadar SADECE process_test_completion
-- ile, yani bir test oturumu TAMAMEN bitirilip trg_on_test_completed tetiklenince
-- guncelleniyordu (rebuild_user_question_stats_for_test, bkz.
-- fix_rebuild_user_question_stats_srs_bugs.sql). QuizClient ise bilincli olarak "sayfadan
-- ayrilirsa oturumu otomatik bitirme" mantigi kullaniyor (kaldigi yerden devam edebilsin
-- diye) — bu yuzden bir ogrenci soru cozup oturumu bitirmezse o sorular SRS tekrar
-- kuyruguna (next_review_at) hic girmiyordu, gunlerce/kalici olarak (bkz. kullaniciyla
-- 2026-09-02 tarihli tartisma: 19 farkli soru cozulmus, user_question_stats'ta sadece 10'u
-- vardi).
--
-- Bu migration user_question_stats'i artik HER cevapta anlik gunceller (asagidaki trigger),
-- rebuild_user_question_stats_for_test ile BIREBIR AYNI puanlama/SRS mantigiyla (streak,
-- next_review_at kademeleri, is_mastered) — sadece bir oturumun TUMUNU degil, TEK bir
-- cevabi isliyor. rebuild_user_question_stats_for_test recorded_in_stats'a hic bakmadan
-- session_id'ye gore TOPLUCA isledigi icin (bkz. fonksiyonun mevcut govdesi), bu trigger'i
-- eklerken process_test_completion icindeki cagrisini KALDIRMAK ZORUNLU — aksi halde bir
-- oturum bitirildiginde ayni cevaplar IKINCI KEZ sayilir (total_attempts, correct/wrong,
-- mastery hepsi sisirilir). Diger 5 adim (gunluk/haftalik istatistik, unite ozeti vb.)
-- degismedi, hala sadece oturum bitince calisiyor.

CREATE OR REPLACE FUNCTION public.sync_user_question_stats_on_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_grade_id bigint;
BEGIN
  SELECT ts.grade_id INTO v_grade_id FROM public.test_sessions ts WHERE ts.id = NEW.test_session_id;
  IF v_grade_id IS NULL THEN
    RETURN NEW;
  END IF;

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
  VALUES (
    NEW.user_id,
    NEW.question_id,
    v_grade_id,
    NEW.is_correct,
    NEW.created_at,
    1,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    CASE WHEN NEW.is_correct THEN 0 ELSE 1 END,
    now() + (CASE WHEN NEW.is_correct = false THEN interval '1 day' ELSE interval '3 day' END),
    now(),
    now(),
    CASE WHEN NEW.is_correct = true THEN 1 ELSE 0 END,
    CASE WHEN NEW.is_correct = true THEN 1 ELSE 0 END,
    false,
    NULL
  )
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

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_user_question_stats_on_answer ON public.test_session_answers;
CREATE TRIGGER trg_sync_user_question_stats_on_answer
  AFTER INSERT ON public.test_session_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_question_stats_on_answer();

-- ZORUNLU: process_test_completion'daki 1. adimi (rebuild_user_question_stats_for_test)
-- kaldiriyoruz — artik yukaridaki trigger her cevapta calistigi icin, oturum bitince
-- TEKRAR calistirmak ayni cevaplari ikinci kez sayardi. Geri kalan 5 adim aynen korundu
-- (mevcut govde birebir, sadece 1. PERFORM satiri yorum satirina alindi).
CREATE OR REPLACE FUNCTION public.process_test_completion(p_test_session_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$DECLARE
BEGIN
    -- 1️⃣ Question-level stats (SRS) — artik trg_sync_user_question_stats_on_answer ile
    --    her cevapta anlik guncelleniyor, burada TEKRAR calistirmak double-count yapar.
    -- PERFORM rebuild_user_question_stats_for_test(p_test_session_id);

    -- 2️⃣ Time-based stats (daily / weekly / monthly / academic_year)
    PERFORM update_user_time_based_stats_on_test_complete(p_test_session_id);

    -- 3️⃣ Curriculum week run summary
    PERFORM build_user_curriculum_week_run_summary_for_test(p_test_session_id);

    -- 4️⃣ Curriculum week seen questions
    PERFORM build_user_curriculum_week_seen_questions_for_test(p_test_session_id);

    -- 5️⃣ Unit test özet tablosu (unit_test)
    PERFORM build_user_unit_summary_for_test(p_test_session_id);

    -- 6 Orkestratör fonksiyonun içine ekleme
    PERFORM build_user_unit_seen_questions_for_test(p_test_session_id);


END;$function$;
