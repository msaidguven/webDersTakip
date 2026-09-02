-- Web quiz oturumları (start_web_quiz_session ile açılan, test_sessions.question_ids
-- doldurulmuş oturumlar) şimdiye kadar SADECE öğrenci sonuç ekranına ulaşıp QuizClient'ın
-- o an çağırdığı finish_test_session RPC'siyle "bitmiş" sayılıyordu (bkz. QuizClient.tsx'teki
-- showResult efekti, satır 551-555). Öğrenci atanmış son soruyu da cevaplayıp sonuç ekranı
-- hiç render olmadan ayrılırsa (sekmeyi kapatma, ağ kopması vb.) completed_at sonsuza kadar
-- boş kalıyordu — oturum verisi %100 tamamlanmış olsa da panelde "Yarım Kaldı" / "Devam Et"
-- gösterilmeye devam ediyordu (bkz. kullanıcıyla 2026-09-02 tartışması).
--
-- Bilinçli olarak İSTEMCİ koduna değil VERİTABANINA bağlanıyor: test_session_answers'a HER
-- cevap eklendiğinde, o oturuma atanmış TÜM sorular (question_ids) artık cevaplanmışsa
-- completed_at kendisi set edilir — istemcinin sonuç ekranına ulaşıp ulaşmadığından tamamen
-- bağımsız. Bu, daha önce denenip kaldırılan "sayfadan ayrılınca otomatik bitir" hatasını
-- TEKRAR GETİRMİYOR: o hata tetikleyicisi "sekme/tab görünürlüğü"
-- idi (yarım kalan oturumlar da anında kapanıyordu); buradaki tetikleyici SADECE gerçek veri
-- durumu — "atanmış sorulardan biri bile eksikse hiçbir şey olmaz", 3/10 cevaplanmış bir
-- oturum sekme kapansa da açık kalmaya devam eder.
--
-- completed_at'i BURADA elle set edip process_test_completion'ı AYRICA çağırmıyoruz —
-- test_sessions üzerindeki mevcut trg_on_test_completed (AFTER UPDATE OF completed_at,
-- WHEN OLD IS NULL AND NEW IS NOT NULL) bu UPDATE'i zaten otomatik yakalayıp
-- process_test_completion_trigger() -> process_test_completion()'ı tetikleyecek. Burada
-- AYRICA çağırmak SRS/günlük/haftalık istatistiklerin ÇİFT SAYILMASINA yol açardı.
-- trg_enforce_completed_at_immutable sadece NULL -> dolu geçişine izin verdiği için
-- (aksi halde exception fırlatıyor) aşağıdaki UPDATE'te "WHERE completed_at IS NULL" şart —
-- hem bu kısıtla uyumlu olmak hem de aynı oturumun iki kez "bitirilmesini" önlemek için.
--
-- Sadece question_ids dolu olan (web quiz: kavrama-testi/unite-testi) oturumları etkiler —
-- mobil uygulamanın start_unit_test akışı question_ids doldurmuyor, bu trigger onu hiç
-- görmez/etkilemez.
-- ÖN KOŞUL — bu trigger'dan tamamen bağımsız, halihazırda var olan bir üretim hatası:
-- process_test_completion'ın 5. ve 6. adımları, artık kaldırılmış iki tabloya
-- (user_unit_summary, user_unit_seen_questions) yazmaya çalışıyordu — ikisi de mobil
-- uygulamaya özgüydü (mobil artık kullanılmıyor) ve web sitesi hiçbir yerde bunları OKUMUYOR
-- (bkz. dashboardStats.ts/dashboardStreak.ts/dashboardUnits.ts'teki notlar: site tüm
-- istatistikleri ham test_session_answers logundan hesaplıyor, bu rollup'lara hiç bakmıyor).
-- Bu adımlar düzeltilmeden aşağıdaki yeni trigger her tetiklendiğinde (her quiz bitişinde)
-- "relation does not exist" hatasıyla test_session_answers'a atılan cevabı geri alıyordu.
--
-- Web sitesi hiçbirini OKUMADIĞI için 2., 3. ve 4. adımları da (zamana dayalı istatistikler,
-- müfredat haftası özetleri) aynı gerekçeyle devre dışı bırakıyoruz — mobil kalmadığına göre
-- bu rollup'ların artık hiçbir tüketicisi yok, sadece gereksiz risk (başka silinmiş bir
-- tabloya daha çarpma ihtimali) taşıyorlardı. Fonksiyonların kendilerine dokunulmadı, sadece
-- orkestratörden çağrılmıyorlar. Web'in gerçekten ihtiyaç duyduğu tek şey — SRS/ustalik
-- (user_question_stats, 1. adım) — zaten HER cevapta ayrı bir trigger'la (bkz.
-- trg_sync_user_question_stats_on_answer) anlık güncelleniyor, burada tekrar yapılması hem
-- gereksiz hem de double-count riski.
CREATE OR REPLACE FUNCTION public.process_test_completion(p_test_session_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$DECLARE
BEGIN
    -- 1️⃣ Question-level stats (SRS) — artik trg_sync_user_question_stats_on_answer ile
    --    her cevapta anlik guncelleniyor, burada TEKRAR calistirmak double-count yapar.
    -- PERFORM rebuild_user_question_stats_for_test(p_test_session_id);

    -- 2️⃣ Time-based stats (daily / weekly / monthly / academic_year) — web bunu hiç okumuyor,
    --    mobil artık yok; devre dışı.
    -- PERFORM update_user_time_based_stats_on_test_complete(p_test_session_id);

    -- 3️⃣ Curriculum week run summary — web bunu hiç okumuyor, mobil artık yok; devre dışı.
    -- PERFORM build_user_curriculum_week_run_summary_for_test(p_test_session_id);

    -- 4️⃣ Curriculum week seen questions — web bunu hiç okumuyor, mobil artık yok; devre dışı.
    -- PERFORM build_user_curriculum_week_seen_questions_for_test(p_test_session_id);

    -- 5️⃣ Unit test özet tablosu (unit_test) — user_unit_summary tablosu kaldırıldı; devre dışı.
    -- PERFORM build_user_unit_summary_for_test(p_test_session_id);

    -- 6️⃣ user_unit_seen_questions tablosu kaldırıldı; devre dışı.
    -- PERFORM build_user_unit_seen_questions_for_test(p_test_session_id);

END;$function$;

CREATE OR REPLACE FUNCTION public.auto_complete_web_quiz_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_question_ids bigint[];
  v_completed_at timestamptz;
  v_answered_count integer;
BEGIN
  SELECT question_ids, completed_at
    INTO v_question_ids, v_completed_at
    FROM public.test_sessions
    WHERE id = NEW.test_session_id;

  -- Zaten bitmiş ya da web quiz akışına ait olmayan (question_ids hiç atanmamış) bir
  -- oturumsa dokunma.
  IF v_completed_at IS NOT NULL OR v_question_ids IS NULL OR array_length(v_question_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT question_id)
    INTO v_answered_count
    FROM public.test_session_answers
    WHERE test_session_id = NEW.test_session_id
      AND question_id = ANY (v_question_ids);

  IF v_answered_count >= array_length(v_question_ids, 1) THEN
    UPDATE public.test_sessions
      SET completed_at = now()
      WHERE id = NEW.test_session_id AND completed_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_complete_web_quiz_session ON public.test_session_answers;
CREATE TRIGGER trg_auto_complete_web_quiz_session
  AFTER INSERT ON public.test_session_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_complete_web_quiz_session();

-- ÖNEMLİ: finish_test_session'ın ŞİMDİKİ hali, zaten tamamlanmış bir oturumu tekrar
-- "bitirmeye" çalışınca (WHERE id = ... AND user_id = auth.uid(), completed_at kontrolü YOK)
-- normalde completed_at'i now()'a tekrar set etmeyi dener — ki bu artık
-- trg_enforce_completed_at_immutable'a çarpıp 'completed_at cannot be modified once set'
-- exception'ı fırlatır. Yukarıdaki trigger devreye girdikten sonra bu ÇOK SIK olacak: öğrenci
-- normal şekilde son soruyu cevaplayıp sonuç ekranına ulaştığında oturum ZATEN yukarıdaki
-- trigger tarafından bitirilmiş olacak, QuizClient'ın hemen ardından çağırdığı
-- finish_test_session ise "zaten bitmiş" bir oturumla karşılaşacak. Bu artık normal bir
-- durum, hata değil — sadece oturum gerçekten yoksa ya da bu kullanıcıya ait değilse hata
-- fırlatılmalı; zaten tamamlanmışsa sessizce (idempotent) başarı dönmeli.
CREATE OR REPLACE FUNCTION public.finish_test_session(p_session_id bigint)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_owned boolean;
BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.test_sessions WHERE id = p_session_id AND user_id = auth.uid()
    ) INTO v_owned;

    IF NOT v_owned THEN
        RAISE EXCEPTION 'Session not found, already completed, or you do not have permission.';
    END IF;

    -- completed_at IS NULL şartı: trg_enforce_completed_at_immutable zaten dolu bir
    -- completed_at'in değişmesine izin vermiyor — burada tekrar denemek yerine sessizce
    -- atlanır (idempotent). Oturum zaten (yukarıdaki trigger tarafından ya da daha önce bu
    -- fonksiyon tarafından) bitirilmişse process_test_completion de zaten çalışmış demektir.
    UPDATE public.test_sessions
    SET completed_at = now()
    WHERE id = p_session_id AND completed_at IS NULL;

    RETURN 'Test session marked as completed successfully.';
END;
$function$;

-- Geriye dönük düzeltme: şu an zaten atanmış tüm sorularını cevaplamış ama completed_at'i
-- hâlâ boş olan (bu bug yüzünden sıkışmış) mevcut oturumları bir kerelik kapatır — bilinçli
-- bir backfill, zaten terk edilmiş geçmiş veriyi düzeltiyor. Her biri normal UPDATE yolundan
-- geçtiği için trg_on_test_completed bunlar için de otomatik tetiklenir — o oturumların
-- istatistikleri de bu vesileyle ilk kez işlenir.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT ts.id
    FROM public.test_sessions ts
    WHERE ts.completed_at IS NULL
      AND ts.question_ids IS NOT NULL
      AND array_length(ts.question_ids, 1) IS NOT NULL
      AND (
        SELECT count(DISTINCT tsa.question_id)
        FROM public.test_session_answers tsa
        WHERE tsa.test_session_id = ts.id
          AND tsa.question_id = ANY (ts.question_ids)
      ) >= array_length(ts.question_ids, 1)
  LOOP
    UPDATE public.test_sessions SET completed_at = now() WHERE id = r.id AND completed_at IS NULL;
  END LOOP;
END $$;
