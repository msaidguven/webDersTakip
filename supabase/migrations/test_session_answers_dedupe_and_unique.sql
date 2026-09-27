-- Test cevaplarını kayıpsız + çiftsiz yapmak (kullanıcı isteği, 2026-09-27; istemci tarafı
-- için bkz. app/src/lib/answerSync.ts):
--   1) Quiz sayacının çift tetiklemesiyle oluşmuş çift cevapları sil (21 Eylül'de 5 adet,
--      hepsi "süre doldu" = yanlış) ve bu yüzden iki kez sayılmış istatistiği düzelt.
--   2) (test_session_id, question_id) benzersiz olsun — istemci artık cevabı yeniden
--      deneyebiliyor / sekme kapanırken tekrar gönderebiliyor; indeks sayesinde aynı cevap
--      kaç kez gelirse gelsin tek satır olur (istemci ON CONFLICT DO NOTHING kullanıyor).
--
-- Tek DO bloğu: Supabase SQL Editor'da geçici tablo + BEGIN/COMMIT ile yazılmış ilk sürüm
-- "relation _dup_answers does not exist" verdi (editör ifadeleri ayrı çalıştırabiliyor).
-- Bu hali tekrar çalıştırılabilir: çift yoksa hiçbir şey değiştirmez. 2026-09-27'de canlıda
-- uygulandı ve doğrulandı (0 çift, istatistikler düzeltilmiş, indeks mevcut).

DO $$
DECLARE
  v_correct_dups integer;
BEGIN
  SELECT count(*) INTO v_correct_dups
  FROM (
    SELECT is_correct,
           row_number() OVER (PARTITION BY test_session_id, question_id ORDER BY id) AS rn
    FROM public.test_session_answers
  ) t
  WHERE rn > 1 AND is_correct;
  IF v_correct_dups > 0 THEN
    RAISE NOTICE '% doğru cevaplı çift kayıt var — istatistiği otomatik düzeltilmedi, elle kontrol edin.', v_correct_dups;
  END IF;

  -- İstatistik: fazladan sayılan her YANLIŞ cevap için deneme/yanlış sayısını geri al ve
  -- yanlışın düşürdüğü kolaylık katsayısını (-0.2) geri ver (streak/aralık zaten doğru).
  UPDATE public.user_question_stats s
     SET total_attempts = GREATEST(0, s.total_attempts - d.n),
         wrong_attempts = GREATEST(0, s.wrong_attempts - d.n),
         ease_factor    = LEAST(3.0, s.ease_factor + 0.2 * d.n),
         updated_at     = now()
    FROM (
      SELECT user_id, question_id, count(*) AS n
      FROM (
        SELECT user_id, question_id, is_correct,
               row_number() OVER (PARTITION BY test_session_id, question_id ORDER BY id) AS rn
        FROM public.test_session_answers
      ) t
      WHERE rn > 1 AND NOT is_correct
      GROUP BY user_id, question_id
    ) d
   WHERE s.user_id = d.user_id AND s.question_id = d.question_id;

  -- Her (oturum, soru) için ilk satır kalır.
  DELETE FROM public.test_session_answers a
   USING (
     SELECT id,
            row_number() OVER (PARTITION BY test_session_id, question_id ORDER BY id) AS rn
     FROM public.test_session_answers
   ) t
   WHERE a.id = t.id AND t.rn > 1;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS test_session_answers_session_question_uniq
  ON public.test_session_answers (test_session_id, question_id);
