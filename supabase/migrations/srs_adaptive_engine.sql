-- SRS motoru şu ana kadar SABİT bir Leitner merdiveni kullanıyordu (3→7→15→33→60→90 gün,
-- yanlışta 1 güne resetleniyordu) — her soru ve her kullanıcı için AYNI aralık, sorunun
-- zorluğuna veya kullanıcının o soruyu ne kadar çabuk unuttuğuna göre hiçbir ayarlama
-- yapmıyordu (bkz. kullanıcıyla 2026-09-04 tarihli backlog: "adet fixed interval, not
-- adaptive"). Bu migration üç şeyi ekliyor:
--
--   1) ADAPTİF ARALIK (basitleştirilmiş SM-2): sabit merdiven yerine her satırın kendi
--      "ease_factor"ı (kolaylık katsayısı) var — doğru cevapta artar (max 3.0), yanlışta
--      azalır (min 1.3). İlk iki doğru cevap klasik SM-2'deki gibi sabit (1 gün, 6 gün);
--      3. doğru cevaptan itibaren aralık = önceki aralık × güncel ease_factor (max 180
--      gün tavanla — süresiz büyümesin diye, eski sistemin 90 günlük tavanının 2 katı,
--      artık kolaylık gerçekten farklılaşabildiği için biraz daha geniş bir tavan makul).
--      Puanlama sistemi ikili (doğru/yanlış, SM-2'nin 0-5 kalite skalası yok) olduğu için
--      ease_factor'ı sabit +0.1/-0.2 adımlarla ayarlıyoruz — çoğu ikili SM-2 varyasyonunun
--      (ör. basit flashcard uygulamaları) kullandığı yaklaşım.
--
--   2) AI YARDIM SİNYALİ: bir öğrenci bir soru hakkında @hocam/@kanka'ya sorduğunda
--      (rag_question_queue.quiz_question_id doluysa) bu "bu soruyu tam anlamadım" demek —
--      şu ana kadar bu sinyal hiç user_question_stats'a dokunmuyordu, soruyu soğukkanlı
--      çözen biriyle AYNI programa giriyordu. Artık: ease_factor hafif düşer, tekrar
--      tarihi en fazla yarın'a çekilir (zaten daha yakın bir tarih varsa ONA dokunulmaz —
--      LEAST kullanıyoruz, sadece öne çekiyoruz asla geriye itmiyoruz). Öğrenci o soruyu
--      HİÇ cevaplamadıysa (satır yoksa) bilerek hiçbir şey yapmıyoruz — "cevaplamadığı bir
--      soru için tekrar zamanı geldi" gibi anlamsız bir durum yaratmamak için.
--
--   3) ai_help_count kolonu: kaç kez AI yardımı istendiğini sayar, tekrar kuyruğu
--      önceliklendirmesinde (bkz. app/src/lib/dashboardSrs.ts) wrong_attempts ile birlikte
--      "leech" (kronik zorlanılan soru) sinyali olarak kullanılıyor — ayrı bir is_leech
--      kolonu EKLEMEDİK, zaten var olan wrong_attempts + bu yeni sayaçtan türetilebilen bir
--      şey için kalıcı/senkronize tutulması gereken fazladan bir kolon gereksiz olurdu.

ALTER TABLE public.user_question_stats
  ADD COLUMN IF NOT EXISTS ease_factor numeric NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_help_count integer NOT NULL DEFAULT 0;

-- Geriye dönük uyumluluk: var olan satırlar eski sabit merdivenle bir yere kadar
-- ilerlemiş durumda. interval_days'i 0 bırakırsak bir sonraki doğru cevapta (streak>=2
-- dalında) aralık × 0 = 1 güne çöker, yani zaten ilerlemiş bir soru aniden sıfırlanmış
-- gibi davranır. Bunun yerine mevcut current_streak'e karşılık gelen ESKİ merdiven
-- değerini "önceki aralık" olarak geriye dolduruyoruz — next_review_at'e DOKUNMUYORUZ
-- (zaten planlanmış tekrarları bozmayalım), sadece bir sonraki cevaptan itibaren yeni
-- motor devreye girsin diye başlangıç noktası veriyoruz. WHERE interval_days = 0 idempotent
-- yapıyor (migration tekrar çalıştırılırsa zaten doldurulmuş satırları ezmez).
UPDATE public.user_question_stats
SET interval_days = CASE current_streak
  WHEN 0 THEN 3
  WHEN 1 THEN 7
  WHEN 2 THEN 15
  WHEN 3 THEN 33
  WHEN 4 THEN 60
  ELSE 90
END
WHERE interval_days = 0;

-- SECURITY DEFINER fonksiyonlarda search_path'i sabitlemek standart bir güvenlik pratiği
-- (aksi halde çağıran biri search_path'i değiştirip fonksiyonun "public.x" yerine kendi
-- şemasındaki isim çakışan bir nesneyi kullanmasını sağlayabilir) — orijinal fonksiyonda
-- eksikti, bu düzeltirken ekliyoruz.
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

-- AI yardım sinyali: sadece öğrenci daha önce bu soruyu en az bir kez cevaplamışsa (satır
-- zaten varsa) etkisi olur — hiç cevaplanmamış bir soru için "tekrar zamanı geldi" gibi
-- anlamsız bir kayıt yaratmamak için bilerek INSERT yapmıyoruz, sadece UPDATE.
CREATE OR REPLACE FUNCTION public.apply_ai_help_signal_to_srs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.quiz_question_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.user_question_stats
  SET
    ai_help_count = ai_help_count + 1,
    ease_factor = GREATEST(1.3, ease_factor - 0.15),
    -- next_review_at teorik olarak null olmamalı (her satır answer-trigger'ından geçip
    -- dolduruluyor) ama LEAST(NULL, x) = NULL döner — COALESCE olmadan bir kenar durumda
    -- tekrar tarihini yanlışlıkla SİLİP soruyu tekrar kuyruğundan tamamen düşürebilirdi.
    next_review_at = LEAST(COALESCE(next_review_at, now() + interval '1 day'), now() + interval '1 day'),
    updated_at = now()
  WHERE user_id = NEW.student_id
    AND question_id = NEW.quiz_question_id
    AND grade_id = NEW.grade_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_apply_ai_help_signal_to_srs ON public.rag_question_queue;
CREATE TRIGGER trg_apply_ai_help_signal_to_srs
  AFTER INSERT ON public.rag_question_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_ai_help_signal_to_srs();
