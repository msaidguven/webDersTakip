-- Aynı öğrencinin aynı soruya aynı anda iki cevabı gelince (quiz sayacının çift tetiklemesi,
-- iki sekme vb.) ikinci INSERT "duplicate key value violates unique constraint
-- user_question_stats_pkey" ile düşüyordu (kullanıcı bildirimi, 2026-09-27). Sebep: tablonun
-- birincil anahtarı (user_id, question_id) iken ON CONFLICT hedefi (user_id, question_id,
-- grade_id) idi — eş zamanlı iki ekleme arbiter olmayan PK'ye çarpınca DO UPDATE'e düşmüyor.
-- Hedef artık PK'nin kendisi; fonksiyonun geri kalanı srs_adaptive_engine.sql ile birebir aynı.

CREATE OR REPLACE FUNCTION public.sync_user_question_stats_on_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_grade_id bigint;
  v_old_streak integer;
  v_old_ease numeric;
  v_old_interval integer;
  v_new_ease numeric;
  v_new_interval integer;
  v_next_review timestamptz;
BEGIN
  SELECT ts.grade_id INTO v_grade_id FROM public.test_sessions ts WHERE ts.id = NEW.test_session_id;
  IF v_grade_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Var olan satırın ease/interval/streak'ini burada okuyoruz — aynı öğrencinin aynı
  -- soruyu aynı anda iki kez cevaplaması (tek cihaz, sıralı submit) beklenmediği için bu
  -- SELECT + aşağıdaki INSERT arasındaki küçük non-atomik pencere pratikte risksiz; buna
  -- karşılık tek bir SQL ifadesi içinde ease/interval hesabını üç kez (kolon + aralık +
  -- next_review_at) tekrarlamaktan çok daha okunabilir/bakımı kolay.
  SELECT current_streak, ease_factor, interval_days
    INTO v_old_streak, v_old_ease, v_old_interval
  FROM public.user_question_stats
  WHERE user_id = NEW.user_id AND question_id = NEW.question_id AND grade_id = v_grade_id;

  v_old_streak := COALESCE(v_old_streak, 0);
  v_old_ease := COALESCE(v_old_ease, 2.5);
  v_old_interval := COALESCE(v_old_interval, 0);

  IF NEW.is_correct THEN
    v_new_ease := LEAST(3.0, v_old_ease + 0.1);
    v_new_interval := CASE
      WHEN v_old_streak = 0 THEN 1
      WHEN v_old_streak = 1 THEN 6
      ELSE LEAST(180, GREATEST(1, ROUND(v_old_interval * v_new_ease)))
    END;
  ELSE
    v_new_ease := GREATEST(1.3, v_old_ease - 0.2);
    v_new_interval := 1;
  END IF;

  v_next_review := now() + make_interval(days => v_new_interval);

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
    mastered_at,
    ease_factor,
    interval_days
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
    v_next_review,
    now(),
    now(),
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    CASE WHEN NEW.is_correct THEN 1 ELSE 0 END,
    false,
    NULL,
    v_new_ease,
    v_new_interval
  )
  ON CONFLICT (user_id, question_id)
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
    ease_factor         = v_new_ease,
    interval_days       = v_new_interval,
    next_review_at      = v_next_review,
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
