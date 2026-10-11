-- Test cevaplarının güvenliği (2026-10-08). Sınav Hazırlık'ta 2026-10-07'de bulunup düzeltilen
-- açıkların aynısı (o proje bu veritabanının birebir kopyasından türedi):
--
-- 1) Doğruluğu tarayıcı belirliyordu: answerSync.ts test_session_answers'a is_correct'i istemcide
--    hesaplayıp doğrudan yazıyordu; politika yalnız user_id'yi denetliyordu → API'den her soruya
--    "doğru" yazılabiliyor, SRS / seri / haftalık sıralama şişirilebiliyordu. Artık tek yazma yolu
--    submit_test_answers: oturum sahipliği, sorunun oturumda olması ve cevabın soruya aitliği
--    denetlenir; is_correct SUNUCUDA hesaplanır (çoktan seçmeli/doğru-yanlış: question_choices,
--    boşluk doldurma: question_blank_options, eşleştirme: question_matching_pairs).
-- 2) user_question_stats'a (SRS/ustalık) kullanıcı doğrudan INSERT/UPDATE edebiliyordu; yalnız
--    tetikleyici (sync_user_question_stats_on_answer, SECURITY DEFINER) yazmalı.
-- 3) "... OR user_id IS NULL" politikaları: giriş yapmamış biri user_id'si boş oturum/cevapları
--    okuyup yazabiliyor, silebiliyordu (test_sessions'ta WITH CHECK yoktu → anon INSERT de açıktı).
--    Kullanıcısız oturum yok (2026-10-08: 0 satır).
-- 4) test_sessions'a doğrudan INSERT/UPDATE/DELETE: oturumlar start_web_quiz_session ile açılıp
--    finish_test_session ile kapanıyor (ikisi de SECURITY DEFINER) — doğrudan yazma gereksizdi.
-- 5) Kullanılmayan eski (mobil/haftalık) RPC'ler istemciye açıktı; bazıları SECURITY DEFINER olup
--    bu tablolara yazıyor → politikaları atlatan arka kapı. Silinmez, istemci çağırma izni geri
--    alınır (tetikleyiciler ve service role etkilenmez). Hiçbiri web kodunda çağrılmıyor.
-- 6) search_path'i sabit olmayan SECURITY DEFINER fonksiyonlar sabitlenir.
--
-- 2. KISIM: KİLİTLEME. YALNIZ şu ikisinden SONRA çalıştır:
--   a) secure_test_answers_1_rpc.sql çalışmış olmalı (submit_test_answers var),
--   b) submit_test_answers'ı kullanan web sürümü canlıda olmalı.
-- Erken çalışırsa canlıdaki eski kodun doğrudan yazması izin hatası (42501) alır, giden kutusu
-- bunu kalıcı hata sayıp cevapları siler.

-- ── 2-4) Politikalar ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Answers access policy" ON public.test_session_answers;
DROP POLICY IF EXISTS "tsa_own_insert" ON public.test_session_answers;
DROP POLICY IF EXISTS "Allow users to insert their own session answers" ON public.test_session_answers;
DROP POLICY IF EXISTS "tsa_own_update" ON public.test_session_answers;
DROP POLICY IF EXISTS "Allow users to read their own session answers" ON public.test_session_answers; -- tsa_own_select ile aynı

DROP POLICY IF EXISTS "Sessions access policy" ON public.test_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.test_sessions;
DROP POLICY IF EXISTS "Allow users to create their own test sessions" ON public.test_sessions;
DROP POLICY IF EXISTS "test_sessions_own_insert" ON public.test_sessions;
DROP POLICY IF EXISTS "Allow users to delete their own test sessions" ON public.test_sessions;
DROP POLICY IF EXISTS "Allow users to update their own test sessions" ON public.test_sessions;
DROP POLICY IF EXISTS "test_sessions_own_update" ON public.test_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.test_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.test_sessions;        -- test_sessions_own_select ile aynı
DROP POLICY IF EXISTS "Allow users to read their own test sessions" ON public.test_sessions; -- aynı

DROP POLICY IF EXISTS "Questions access policy" ON public.test_session_questions;
DROP POLICY IF EXISTS "Users can insert their own session questions" ON public.test_session_questions;
DROP POLICY IF EXISTS "Users can view their own session questions" ON public.test_session_questions; -- tsq_own_select ile aynı

DROP POLICY IF EXISTS "Users can insert own question stats" ON public.user_question_stats;
DROP POLICY IF EXISTS "Users can update own question stats" ON public.user_question_stats;

-- Tablo düzeyinde de yazma izni yok (politika eklenirse bile istemci yazamasın).
REVOKE INSERT, UPDATE, DELETE ON public.test_session_answers, public.test_sessions,
  public.test_session_questions, public.user_question_stats FROM anon, authenticated;

-- ── 5) Kullanılmayan eski RPC'ler: istemci çağıramaz ────────────────────────

DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'calculate_test_session_score', 'create_unit_test_session_and_get_questions', 'create_weekly_test_session',
        'finish_test_v21', 'finish_weekly_test', 'rebuild_user_question_stats_for_test', 'start_normal_test_session',
        'start_weekly_test_silinecek', 'admin_purge_student_data_for_questions', 'admin_purge_student_data_for_units',
        'apply_ai_help_signal_to_srs', 'create_test_session_and_get_questions', 'finish_test', 'link_guest_data_to_user',
        'start_srs_test_session', 'start_test', 'start_unit_test', 'start_weekly_test_session',
        'start_weekly_test_session_by_outcomes', 'sync_user_question_stats')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
