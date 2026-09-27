'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ListChecks, Loader2, Maximize2, PartyPopper, Trophy, X, ZoomIn } from 'lucide-react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';
import { MAX_QUESTIONS_PER_TEST, type QuizQuestion } from '@/app/src/lib/quizQuestions';
import { useAuth } from '@/app/src/context/AuthContext';
import { submitAnswers, startSessionWithRetry } from '@/app/src/lib/answerSync';
import {
  SLIDE_ACCENTS as ACCENTS,
  NAV_BTN_CLASS,
  PLAYER_BADGE_CLASS,
  PLAYER_NAV_ROW_CLASS,
  PLAYER_TOP_BAR_CLASS,
  PlayerEyebrow,
  FontScaleControl,
  OverlayWindowButtons,
  PlayerFrame,
  QuestionPills,
  QuestionStack,
  useFullscreen,
  useQuestionRunner,
  useSwipe,
  type AnswerStatus,
} from '@/app/src/components/questionPlayer/QuestionPlayerParts';

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Renk paleti, yazı büyütme sınırları, numara şeridi ve soru sayacı artık soru bankası test
// modalıyla ORTAK — bkz. questionPlayer/QuestionPlayerParts.tsx (2026-09-26).

// Görsel/diyagram olmayan section slaytları için dekoratif, konu-nötr bir desen — her slayt
// bomboş/yazı-yığını gibi hissetmesin diye. Rastgele değil (SSR/hydration'da tutarlı olsun
// diye slaytKey'e göre deterministik), gerçek bir görselin yerine geçmiyor ama boşluğu
// renkli/canlı tutuyor.
function DecorativePattern({ seed, from, to }: { seed: number; from: string; to: string }) {
  const rings = [0.9, 0.65, 0.4];
  const rotate = (seed * 37) % 360;
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" style={{ transform: `rotate(${rotate}deg)` }}>
      <defs>
        <linearGradient id={`slide-decor-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      {rings.map((r, i) => (
        <circle
          key={i}
          cx="100"
          cy="100"
          r={80 * r}
          fill="none"
          stroke={`url(#slide-decor-${seed})`}
          strokeWidth={i === rings.length - 1 ? 10 : 3}
          strokeDasharray={i % 2 === 0 ? '2 10' : undefined}
          opacity={0.55 - i * 0.12}
        />
      ))}
      <circle cx="100" cy="100" r="22" fill={`url(#slide-decor-${seed})`} opacity={0.85} />
    </svg>
  );
}

type SlidePlayerProps = {
  deck: SlideDeck;
  // Sunum bitince "Soruları Çöz" adımı için konunun soru bankasını çekmek amacıyla lazım
  // (bkz. /api/topics/[topicId]/all-questions) — öğretmen akıllı tahtada sırayla gösterip
  // çözdürüyor (kullanıcının 2026-09-21 isteği); giriş yapmış bir öğrenci içinse istatistiğe
  // de yazılıyor (bkz. recordSlideQuizAnswer).
  topicId: number;
  // İstatistik kaydı (test_sessions) için — grade_id ZORUNLU: sync_user_question_stats_on_answer
  // trigger'ı grade_id NULL olan bir oturumun cevaplarını SESSİZCE user_question_stats'a
  // YAZMIYOR (bkz. o migration'daki "IF v_grade_id IS NULL THEN RETURN NEW" satırı) — bu
  // ikisi verilmeden test_session_answers'a satır düşse bile SRS/panel/liderlik tablosu hiç
  // güncellenmez (kullanıcının 2026-09-22 "çözdüm ama görünmedi" bulduğu gerçek bug).
  // lessonId/unitId zorunlu değil ama tutarlılık için veriliyorsa geçiliyor.
  gradeId?: number | null;
  lessonId?: number | null;
  unitId?: number | null;
  // 'overlay' (varsayılan): tam ekranı kaplayan, karartılmış arka planlı sunum modu (Escape/X
  // ile kapanır). 'embedded': ders sayfasına gömülü, normal sayfa akışında bir kart — kapatma
  // yok, sağ üstte sadece "tam ekranda aç" (onExpand) butonu var.
  variant?: 'overlay' | 'embedded';
  onClose?: () => void;
  onExpand?: () => void;
};

export default function SlidePlayer({ deck, topicId, gradeId = null, lessonId = null, unitId = null, variant = 'overlay', onClose, onExpand }: SlidePlayerProps) {
  const [index, setIndex] = useState(0);
  // Bir "section" slaydına ilk girildiğinde madde listesi tek seferde değil, ok tuşuna/
  // "İleri"ye her basışta bir madde daha açılarak (kademeli) gösterilir — öğretmenin sınıfta
  // konuşma temposuna uysun, öğrenci kendi başına çalışırken de adım adım özümsesin diye.
  const [revealedCount, setRevealedCount] = useState(1);
  // Görsel (img) ile diyagram (ham SVG markup) farklı şekilde render edildiği için (biri
  // <img src>, diğeri dangerouslySetInnerHTML) lightbox'ın ikisini de büyütebilmesi için tip
  // ayrımı gerekiyor.
  const [lightbox, setLightbox] = useState<{ kind: 'image'; src: string } | { kind: 'svg'; html: string } | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  // Slaytlar bitince ('outro') tebrik ekranı, sonra istenirse ('questions') konunun soru
  // bankası aynı tam ekran kabukta, slayt slayt (1 soru/slayt) gösteriliyor.
  const [phase, setPhase] = useState<'slides' | 'outro' | 'questions'>('slides');
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  // API, giriş yapmış kullanıcıda kişiselleştirilmiş 10'luk bir parti döndürüyor (misafirde tüm
  // sorular, bkz. guestPool); allCaughtUp "havuzda şu an çözülmeye uygun soru kalmadı" durumunu
  // tur özet ekranında bir not olarak göstermek için.
  const [questionsAllCaughtUp, setQuestionsAllCaughtUp] = useState(false);
  // Kişiselleştirilmiş 10'luk parti bitince ("Bitir"e basılınca) mini bir özet ekranı
  // gösterip "Yeni 10 Soru Çöz" ile bir sonraki partiye geçilebiliyor — phase 'questions'
  // olarak kalıyor, sadece bu bayrak soru kartı yerine özet kartını render ettiriyor (yeni
  // bir phase değeri açıp header/nav'daki onlarca `phase !== 'outro'` kontrolünü tek tek
  // güncellemek yerine).
  const [showBatchResult, setShowBatchResult] = useState(false);
  // Özet ekranı SADECE soru fazındayken geçerli — bayrak bir şekilde açık kalsa bile (ör.
  // "Slaytlara Dön") slayt fazının üst/alt kontrolleri gizlenmesin (2026-09-26 bug'ı).
  const inBatchResult = phase === 'questions' && showBatchResult;
  // Misafirde (akıllı tahta) API konunun TÜM sorularını döndürüyor — 2026-09-26'dan beri o da
  // 10'luk turlarla çözülüyor: havuz bir kez karıştırılıp sırayla dilimleniyor, "Yeni 10 Soru"
  // görülmemiş sonraki 10'u verir (öğretmen tüm soruları tekrarsız dolaşabilsin), havuz bitince
  // baştan başlar. Giriş yapmış kullanıcıda bu null kalır; her tur API'den kişiselleştirilmiş gelir.
  const [guestPool, setGuestPool] = useState<QuizQuestion[] | null>(null);
  const [guestBatchStart, setGuestBatchStart] = useState(0);
  const runner = useQuestionRunner({
    questions,
    active: phase === 'questions' && !inBatchResult,
    onAnswer: (id, status) => onRunnerAnswerRef.current(id, status),
  });
  const { qIndex, attempt: questionsAttempt, answeredMap, restart: runnerRestart, goTo: goToQuestion } = runner;
  // onRunnerAnswer aşağıda (kayıt fonksiyonlarından sonra) tanımlanıyor — ref ile bağlanıyor.
  const onRunnerAnswerRef = useRef<(id: number, status: AnswerStatus) => void>(() => {});
  // Giriş yapmış öğrenci evde tek başına slayttan soru çözüyorsa bu da istatistiğe (SRS,
  // panel, liderlik tablosu) yansımalı — aksi halde emeği boşa gider (kullanıcının 2026-09-22
  // isteği). QuizClient'taki AYNI test_sessions/test_session_answers akışının daha sade bir
  // kopyası: burada resume/"Tekrar Çöz"/klasik(açık uçlu) soru YOK (konu havuzu zaten
  // question_type_id=4'ü hariç tutuyor, bkz. getTopicQuestionPoolIds), o yüzden QuizClient'ın
  // tüm karmaşıklığını buraya taşımak yerine küçük, bu ekrana özel bir sürüm yazıldı.
  // Misafirde (isAuthenticated=false — akıllı tahtadaki tipik durum) hiçbir şey kaydedilmez.
  const { isAuthenticated, user, supabase } = useAuth();
  const [quizSessionId, setQuizSessionId] = useState<number | null>(null);
  const [hasAnsweredOnceInSlides, setHasAnsweredOnceInSlides] = useState(false);
  const quizClientIdRef = useRef<string>('');
  const quizSessionQuestionsKeyRef = useRef<string | null>(null);
  const quizPendingAnswersRef = useRef<{ questionId: number; isCorrect: boolean; durationSeconds: number }[]>([]);
  const questionStartRef = useRef<number>(0);
  // Deck/konu değişince (embedded SlidePlayer sayfada sabit kalıp deck prop'u değiştiği için)
  // her şeyi baştan başlat — aksi halde önceki konunun ortasında/sorularında kalınırdı.
  useEffect(() => {
    setIndex(0);
    setRevealedCount(1);
    setPhase('slides');
    setQuestions(null);
    setGuestPool(null);
    setGuestBatchStart(0);
    setQuestionsError(null);
    setQuestionsAllCaughtUp(false);
    setShowBatchResult(false);
    runnerRestart();
    setAnimKey((k) => k + 1);
    setQuizSessionId(null);
    setHasAnsweredOnceInSlides(false);
    quizSessionQuestionsKeyRef.current = null;
    quizPendingAnswersRef.current = [];
  }, [topicId, runnerRestart]);

  // clientId'yi mount'ta bir kez oluşturur (test_session_answers.client_id NOT NULL) —
  // QuizClient'taki aynı desen (bkz. o dosyadaki clientIdRef efekti).
  useEffect(() => {
    if (!quizClientIdRef.current) {
      quizClientIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }
  }, []);

  // Giriş yapmış kullanıcı ilk cevabı verince (hasAnsweredOnceInSlides) bu soru setiyle bir
  // test_sessions kaydı açar — session, tıklayıp hiç soru çözmeden çıkanlar için anlamsız bir
  // "yarım kalan test" oluşturmasın diye sayfa açılır açılmaz değil, İLK CEVAPTA açılıyor
  // (QuizClient ile aynı gerekçe). Tüm sorular cevaplanınca (auto_complete_web_quiz_session
  // trigger'ı) oturum kendiliğinden tamamlanmış sayılır — burada ayrıca finish_test_session
  // çağırmaya gerek yok.
  useEffect(() => {
    if (!isAuthenticated || !user || !questions || questions.length === 0 || !hasAnsweredOnceInSlides) return;
    const questionsKey = questions.map((q) => q.id).join(',');
    if (quizSessionQuestionsKeyRef.current === questionsKey) return;
    quizSessionQuestionsKeyRef.current = questionsKey;

    if (!quizClientIdRef.current) {
      quizClientIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }

    // test_session_questions.order_no'da DB'de CHECK (order_no >= 1 AND order_no <= 10) var
    // (uygulama genelinde MAX_QUESTIONS_PER_TEST=10 ile eşleşen sabit bir sınır) — SlidePlayer
    // konunun TÜM sorularını (bazı konularda 10'dan fazla) göndermeye çalışınca bu kısıt tüm
    // RPC'yi başarısız kılıp session'ın hiç açılmamasına yol açıyordu (kullanıcının "çözdüm ama
    // hiçbir şey görünmedi" bulduğu gerçek bug — "start_web_quiz_session error: ... order_check
    // violates"). Sadece bu "atama" adımı 10'a kesiliyor; questions zaten SRS'e göre öncelik
    // sıralı geldiği için (bkz. getAllTopicQuestionsPrioritized) ilk 10 zaten en değerlileri.
    // Bunun ötesinde cevaplanan sorular da (recordSlideQuizAnswer) YİNE user_question_stats'a
    // yazılır — o kayıt bu 10'luk atama listesine bağlı değil, her cevapta ayrı çalışır.
    const assignedQuestionIds = questions.slice(0, MAX_QUESTIONS_PER_TEST).map((q) => q.id);

    void startSessionWithRetry<number>(() =>
      supabase.rpc('start_web_quiz_session', {
        p_client_id: quizClientIdRef.current,
        p_grade_id: gradeId,
        p_lesson_id: lessonId,
        p_unit_id: unitId,
        p_topic_id: topicId,
        p_question_ids: assignedQuestionIds,
      })
    ).then((data) => {
      if (typeof data === 'number') setQuizSessionId(data);
    });
    // user (nesne) yerine user?.id: bkz. QuizClient'taki aynı efektin gerekçesi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, questions, hasAnsweredOnceInSlides, supabase, topicId, gradeId, lessonId, unitId]);

  // sessionId hazır olduğunda, ondan önce (hızlı cevaplayan kullanıcıda) kuyruklanmış
  // cevapları gönderir — bkz. QuizClient'taki syncSession ile aynı desen, sadece burada
  // "test bitince finish_test_session çağır" adımı YOK (auto-complete trigger'ı yeterli).
  useEffect(() => {
    if (quizSessionId == null || !user) return;
    if (quizPendingAnswersRef.current.length === 0) return;
    const toFlush = quizPendingAnswersRef.current;
    quizPendingAnswersRef.current = [];
    void submitAnswers(
      supabase,
      toFlush.map((a) => ({
        test_session_id: quizSessionId,
        question_id: a.questionId,
        user_id: user.id,
        client_id: quizClientIdRef.current,
        is_correct: a.isCorrect,
        duration_seconds: a.durationSeconds,
      }))
    );
    // user (nesne) yerine user?.id: Supabase TOKEN_REFRESHED gibi olaylarda user nesnesi aynı
    // kullanıcı için bile yeni bir referansla gelir — bkz. QuizClient'taki aynı gerekçe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizSessionId, user?.id, supabase]);

  // "Soruları tekrar çöz" (yeni deneme) = yeni oturum: aynı soru seti aynı oturumda kalsaydı
  // ikinci denemenin cevapları (oturum, soru) benzersizliğine takılıp istatistiğe yazılmazdı.
  const lastAttemptRef = useRef(questionsAttempt);
  useEffect(() => {
    if (lastAttemptRef.current === questionsAttempt) return;
    lastAttemptRef.current = questionsAttempt;
    setQuizSessionId(null);
    setHasAnsweredOnceInSlides(false);
    quizSessionQuestionsKeyRef.current = null;
    quizPendingAnswersRef.current = [];
  }, [questionsAttempt]);

  // Her sorunun görülme anını tutar (duration_seconds için) — soru değişince sıfırlanır.
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [qIndex, questionsAttempt]);

  const recordSlideQuizAnswer = useCallback(
    (questionId: number, isCorrect: boolean) => {
      if (!isAuthenticated || !user) return;
      if (!hasAnsweredOnceInSlides) setHasAnsweredOnceInSlides(true);
      const durationSeconds = Math.max(0, Math.round((Date.now() - questionStartRef.current) / 1000));
      if (quizSessionId == null) {
        quizPendingAnswersRef.current.push({ questionId, isCorrect, durationSeconds });
        return;
      }
      void submitAnswers(supabase, [{
        test_session_id: quizSessionId,
        question_id: questionId,
        user_id: user.id,
        client_id: quizClientIdRef.current,
        is_correct: isCorrect,
        duration_seconds: durationSeconds,
      }]);
    },
    // user (nesne) yerine user?.id — bkz. yukarıdaki flush efektindeki aynı gerekçe. Bu
    // fonksiyonun referansı sabit kalmalı ki aşağıdaki handleQuestionAnswered (ve dolayısıyla
    // memo'lu QuestionAnswerKeyItem) gereksiz yere değişmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, user?.id, hasAnsweredOnceInSlides, quizSessionId, supabase]
  );

  // Soru fazı durumu (aktif soru, cevaplar, 60 sn sayaç, şerit) ortak hook'ta — bkz.
  // QuestionPlayerParts. Klasik (açık uçlu) soru bu havuzda yok; yine de sadece
  // correct/incorrect istatistiğe yazılır.
  const onRunnerAnswer = useCallback(
    (id: number, status: AnswerStatus) => {
      if (status === 'correct' || status === 'incorrect') recordSlideQuizAnswer(id, status === 'correct');
    },
    [recordSlideQuizAnswer]
  );
  useEffect(() => {
    onRunnerAnswerRef.current = onRunnerAnswer;
  }, [onRunnerAnswer]);

  useEffect(() => {
    // Eskiden sadece 'outro' (tebrik ekranı) fazında tetikleniyordu — artık üst çubuktaki
    // "Sorulara Geç" kısayolu (bkz. jumpToQuestions) slaytları atlayıp doğrudan 'questions'
    // fazına geçebildiği için, sorular henüz yüklenmemişse o fazda da fetch tetiklenmeli.
    if ((phase !== 'outro' && phase !== 'questions') || questions !== null || questionsLoading) return;
    setQuestionsLoading(true);
    setQuestionsError(null);
    fetch(`/api/topics/${topicId}/all-questions`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        const fetched = (data.questions as QuizQuestion[]) || [];
        if (data.personalized) {
          setQuestions(fetched);
        } else {
          const shuffled = shuffle(fetched);
          setGuestPool(shuffled);
          setGuestBatchStart(0);
          setQuestions(shuffled.slice(0, MAX_QUESTIONS_PER_TEST));
        }
        setQuestionsAllCaughtUp(!!data.allCaughtUp);
      })
      .catch(() => setQuestionsError('Sorular yüklenemedi.'))
      .finally(() => setQuestionsLoading(false));
  }, [phase, topicId, questions, questionsLoading]);

  const total = deck.slides.length;
  const slide = deck.slides[index];
  const isLastSlide = index === total - 1;
  const showTip = phase === 'slides' && isLastSlide && !!deck.tip?.content;
  const accent = phase === 'questions' ? ACCENTS[qIndex % ACCENTS.length] : ACCENTS[index % ACCENTS.length];
  const bulletsLeft = phase === 'slides' && slide.kind === 'section' ? Math.max(0, slide.bullets.length - revealedCount) : 0;

  const startQuestions = useCallback(() => {
    setPhase('questions');
    setShowBatchResult(false);
    runnerRestart();
    setAnimKey((k) => k + 1);
  }, [runnerRestart]);

  // Tur bitince özet ekranındaki "Yeni 10 Soru Çöz". Giriş yapmışta: questions'ı null'a çekmek
  // fetch efektini yeniden tetikler — her cevap user_question_stats'a işlendiği için API doğal
  // olarak yeni öncelikli bir 10'luk döndürür. Misafirde: karıştırılmış havuzun sonraki dilimi.
  const nextGuestStart = guestPool ? (guestBatchStart + MAX_QUESTIONS_PER_TEST >= guestPool.length ? 0 : guestBatchStart + MAX_QUESTIONS_PER_TEST) : 0;
  const startNewBatch = useCallback(() => {
    if (guestPool) {
      setGuestBatchStart(nextGuestStart);
      setQuestions(guestPool.slice(nextGuestStart, nextGuestStart + MAX_QUESTIONS_PER_TEST));
    } else {
      setQuestions(null);
    }
    setQuestionsError(null);
    startQuestions();
  }, [startQuestions, guestPool, nextGuestStart]);

  const goPrev = useCallback(() => {
    if (phase === 'questions') {
      if (qIndex > 0) goToQuestion(qIndex - 1);
      else setPhase('slides');
      setAnimKey((k) => k + 1);
      return;
    }
    if (phase === 'outro') {
      setPhase('slides');
      setAnimKey((k) => k + 1);
      return;
    }
    setIndex((i) => Math.max(0, i - 1));
    setRevealedCount(1);
    setAnimKey((k) => k + 1);
  }, [phase, qIndex, goToQuestion]);

  const goNext = useCallback(() => {
    if (phase === 'questions') {
      if (questions && qIndex < questions.length - 1) {
        goToQuestion(qIndex + 1);
        setAnimKey((k) => k + 1);
        return;
      }
      // Son soru da cevaplandıysa "Bitir" tur özet ekranını açar (misafir + giriş yapmış).
      if (questions && answeredMap[questions[qIndex]?.id] != null) {
        setShowBatchResult(true);
        setAnimKey((k) => k + 1);
      }
      return;
    }
    if (phase === 'outro') {
      startQuestions();
      return;
    }
    if (bulletsLeft > 0) {
      setRevealedCount((c) => c + 1);
      return;
    }
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setRevealedCount(1);
      setAnimKey((k) => k + 1);
      return;
    }
    setPhase('outro');
    setAnimKey((k) => k + 1);
  }, [phase, qIndex, questions, bulletsLeft, index, total, startQuestions, answeredMap, goToQuestion]);

  const jumpTo = useCallback((i: number) => {
    if (phase === 'questions') {
      goToQuestion(i);
    } else {
      setIndex(i);
      setRevealedCount(1);
    }
    setAnimKey((k) => k + 1);
  }, [phase, goToQuestion]);

  // Kilitli (henüz açılmamış) bir maddeye tıklayınca o maddeye kadar hepsini aç — "İleri"ye
  // art arda basmak yerine öğretmen/öğrenci istediği maddeye doğrudan atlayabilsin.
  const revealUpTo = useCallback((bulletIndex: number) => {
    setRevealedCount((c) => Math.max(c, bulletIndex + 1));
  }, []);

  // Eskiden kaydırma (swipe) bir slaytın KALAN TÜM maddelerini birden açıyordu ("bu slaytla
  // işim bitti, sıradakine geç" niyeti) — ama mobilde artık her adımda TEK madde tam ekran
  // gösteriliyor (kullanıcının 2026-09-22 isteği), bu yüzden swipe da tıklama/"İleri" ile
  // AYNI tek-adım mantığına (goNext) bağlandı; aksi halde bir kaydırma mobildeki tüm madde
  // sayfalarını atlayıp doğrudan slaydın sonuna zıplardı.
  const { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd } = useSwipe(goNext, goPrev, !!lightbox);

  const isOverlay = variant === 'overlay';

  // Üst çubuktaki küçük rozetler (%büyütme, D:/Y:, sayfa sayacı) +/- ile birlikte büyüsün diye
  // — eskiden sabit [9-11px] kalıyorlardı, metin kocaman olunca orantısız kalıyordu
  // (kullanıcının 2026-09-21 isteği).
  const smallBadgeStyle = useCallback(
    (basePx: number) => (fontScale !== 1 ? { fontSize: `${basePx * fontScale}px` } : undefined),
    [fontScale]
  );

  // Slayt (özet/kapak/tebrik) metinleri de eskiden `zoom` ile büyütülüyordu — ama zoom kutunun
  // TAMAMINI (görsel kutusu, boşluklar, sabit yükseklikli satır) büyüttüğü için, kart sabit
  // 16:9 boyda kalınca içerik card'ın dışına taşıp kırpılıyor, satırlar/görsel üst üste
  // biniyordu ("çok saçma bir şekil" — kullanıcının 2026-09-21 şikayeti). Artık questions
  // fazındaki gibi SADECE metin font-size'ı (+ orantılı line-height) büyüyor, görsel kutusu ve
  // dolgular sabit kalıyor; madde listesi de taştığında kırpılmak yerine kendi içinde kayabiliyor
  // (bkz. aşağıdaki overflow-y-auto).
  const slideTextStyle = useCallback(
    (baseRem: number, lineHeight = 1.3) => (fontScale !== 1 ? { fontSize: `${baseRem * fontScale}rem`, lineHeight } : undefined),
    [fontScale]
  );

  // Klavye kısayolları (ok tuşları/boşluk/Escape) sadece overlay (tam ekran modal) modunda
  // global window listener'ı ile çalışır. Embedded (sayfaya gömülü) modda bunu global
  // dinlersek, sayfadaki bir arama kutusuna yazarken ya da başka bir formda boşluk/ok tuşuna
  // basıldığında slaytlar da kayardı — bu yüzden embedded'da klavye kısayolu yok, sadece
  // buton/tıklama ile ilerleniyor.
  useEffect(() => {
    if (!isOverlay) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) return; // ayrı bir click-outside/X ile kapanıyor, aşağıda ele alınıyor
        // Tam ekrandaysak Escape'i tarayıcı zaten fullscreen'den çıkmak için kullanır —
        // sunumu da kapatırsak öğretmen tek Escape'te hem tam ekrandan hem sunumdan çıkar,
        // bu şaşırtıcı olur. Sadece tam ekran değilken sunumu kapat.
        if (!document.fullscreenElement) onClose?.();
      } else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight' || e.key === ' ') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOverlay, onClose, goPrev, goNext, lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  // 'questions' fazında kart her qIndex değişiminde REMOUNT edilirse içindeki
  // QuestionAnswerKeyItem'lar da sıfırlanır (seçim/reveal kaybolur) — bu yüzden o fazda
  // animKey yerine questionsAttempt kullanılıyor (sadece "Soruları Çöz"e yeniden basılınca
  // değişir), giriş animasyonu sadece o an bir kere oynar, qIndex gezinirken kart sabit kalır.
  const cardKey = phase === 'questions' ? `questions-${questionsAttempt}` : animKey;

  const cleanSvg = useMemo(() => (slide.diagramSvg ? sanitizeMathSvg(slide.diagramSvg) : null), [slide.diagramSvg]);
  const imageOnRight = index % 2 === 0;
  const visualSrc = slide.imageUrl;

  // Mobilde kart neredeyse tüm genişliği/yüksekliği kapladığı için yarı saydam beyaz butonlar
  // beyaz kartın üstüne denk gelip kayboluyordu (kullanıcının 2026-09-21 bulduğu regresyon) —
  // hem overlay hem embedded'da koyu, opak bir varyant kullanılıyor; bu hem koyu backdrop hem
  // beyaz kart üstünde okunuyor.
  // Nokta göstergesi artık her zaman beyaz kartın İÇİNDE (eskiden overlay'de kartın altında,
  // koyu arka plan üstündeydi) — bu yüzden isOverlay'e göre değil, her zaman açık zeminde
  // okunan tonda (kullanıcının 2026-09-21 isteğiyle oklar/noktalar slayda taşındı).
  const inactiveDotColor = 'rgba(15,23,42,0.18)';

  return (
    <>
      {/* Çerçeve (karartılmış arka plan / gömülü kart, dekoratif blob'lar, renkli şerit)
          soru bankası test modalıyla ortak — bkz. PlayerFrame. */}
      <PlayerFrame
        variant={variant}
        accent={accent}
        containerRef={containerRef}
        cardKey={cardKey}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        headerResetKey={phase === 'questions' ? `q-${qIndex}` : `${phase}-${index}`}
        header={
          <div className={PLAYER_TOP_BAR_CLASS}>
            <div className="min-w-0 w-full sm:w-auto">
              {deck.eyebrowText && <PlayerEyebrow text={deck.eyebrowText} accent={accent} fontScale={fontScale} />}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              {phase !== 'outro' && !inBatchResult && (
                <>
                  {/* Slaytların tamamını izlemeden doğrudan sorulara atlamak için kısayol —
                      eskiden tek yol slaytların sonuna kadar gidip "Soruları Çöz"e basmaktı
                      (kullanıcının 2026-09-22 "ayrı bir sekme olsa iyi olmaz mı" isteği).
                      startQuestions zaten qIndex/answeredMap'i sıfırlayıp 'questions' fazına
                      geçiyor; sorular henüz çekilmediyse aşağıdaki fetch efekti (artık
                      'questions' fazında da tetiklenecek şekilde genişletildi) devreye girer. */}
                  {phase === 'slides' && (
                    <button
                      type="button"
                      onClick={startQuestions}
                      aria-label="Sorulara geç"
                      title="Sorulara geç"
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 px-1.5 sm:px-2 py-1.5 text-[10px] sm:text-[11px] font-black text-slate-500 shadow-sm transition-colors hover:bg-slate-100"
                    >
                      <ListChecks className="h-3.5 w-3.5 shrink-0" />
                      {/* Diğer üst çubuk rozetleri (%büyütme, D:/Y:, sayfa sayacı) +/- ile
                          büyüyor ama bu yazı unutulmuştu — sabit kalıyordu (kullanıcının
                          2026-09-22 bulduğu eksiklik). */}
                      <span className="hidden sm:inline" style={smallBadgeStyle(11)}>Sorulara Geç</span>
                    </button>
                  )}
                  <FontScaleControl fontScale={fontScale} onChange={setFontScale} badgeStyle={smallBadgeStyle(10)} />
                  {phase === 'questions' && (
                    <div className={`hidden sm:block ${PLAYER_BADGE_CLASS}`} style={smallBadgeStyle(11)}>
                      <span className="text-emerald-600">D:{runner.correctCount}</span>
                      {' '}
                      <span className="text-rose-500">Y:{runner.incorrectCount}</span>
                    </div>
                  )}
                  <div className={`text-slate-500 ${PLAYER_BADGE_CLASS}`} style={smallBadgeStyle(11)}>
                    {phase === 'questions' ? `${qIndex + 1}/${questions?.length ?? '…'}` : `${index + 1}/${total}`}
                  </div>
                </>
              )}
              {isOverlay ? (
                <OverlayWindowButtons isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={onClose} />
              ) : (
                <button
                  type="button"
                  onClick={onExpand}
                  aria-label="Tam ekranda aç"
                  title="Tam ekranda aç"
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 transition-colors shadow-sm"
                >
                  <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
          </div>
        }
      >
          {/* Tek, akışta (absolute değil) üst kontrol çubuğu — küçültme/büyütme, sayfa sayacı ve
              tam ekran/kapat butonları burada birleşiyor. Eskiden bu kontroller kartın üstüne
              absolute konumlanıyordu ve dar ekranlarda alt satıra sarınca başlığın üstüne
              biniyordu (kullanıcının 2026-09-21 bulduğu regresyon) — artık normal akışta kendi
              satırını kaplıyor, başlık her zaman bunun altından başlıyor. */}
          {/* Mobilde eskiden eyebrow rozeti (sınıf · ders · ünite zinciri, tek satırda 40+
              karakter) ile sağdaki kontrol grubu AYNI satırda yan yana sıkıştırılıyordu —
              dar ekranda rozet 3-4 satıra sarınca kontroller (büyüt/küçült, sayfa sayacı,
              tam ekran, X) rozetin yanına küçük ve sıkışık kalıyordu (kullanıcının
              2026-09-24 "üst üste/sıkışık, X butonu falan olsa iyi olur" şikayeti — buton
              zaten vardı ama görünürlüğü zayıftı). Artık mobilde iki ayrı, ferah satır:
              rozet KENDİ satırında tek satıra kırpılıyor (truncate), kontroller altında tam
              genişlikte kendi satırını kaplıyor. sm+ ekranda eskisi gibi tek satır. */}
          {phase === 'outro' ? (
            <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-4 text-center" style={{ background: `linear-gradient(135deg, ${accent.from}22, white 55%)` }}>
              <div
                className="relative z-[1] flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full shadow-lg shrink-0"
                style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
              >
                <Trophy className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <h2 className="relative z-[1] text-xl sm:text-3xl font-black text-slate-800" style={slideTextStyle(1.875, 1.2)}>
                <PartyPopper className="mr-2 inline h-5 w-5 sm:h-7 sm:w-7 text-amber-500" />
                Tebrikler, konuyu tamamladın!
              </h2>
              <p className="relative z-[1] max-w-md text-sm sm:text-base font-medium text-slate-500" style={slideTextStyle(1, 1.4)}>
                {deck.topicTitle} konusunu baştan sona bitirdin. Şimdi öğrendiklerini sorularla pekiştirmeye ne dersin?
              </p>
              {questionsLoading ? (
                <p className="relative z-[1] text-xs font-bold text-slate-400">Sorular yükleniyor...</p>
              ) : questionsError ? (
                <p className="relative z-[1] text-xs font-bold text-rose-500">{questionsError}</p>
              ) : questions && questions.length === 0 ? (
                <p className="relative z-[1] text-xs font-bold text-slate-400">Bu konu için henüz soru eklenmemiş.</p>
              ) : (
                <button
                  type="button"
                  onClick={startQuestions}
                  disabled={!questions}
                  className="relative z-[1] mt-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                >
                  Soruları Çöz →
                </button>
              )}
            </div>
          ) : phase === 'questions' && !questions ? (
            // "Sorulara Geç" kısayolu slaytları atlayıp doğrudan buraya gelebiliyor — bu
            // durumda sorular henüz çekilmemiş/hata almış olabilir, tebrik ekranındaki aynı
            // yükleniyor/hata görünümü burada da gösteriliyor.
            <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              {questionsError ? (
                <p className="text-sm font-bold text-rose-500">{questionsError}</p>
              ) : (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  <p className="text-xs font-bold text-slate-400">Sorular yükleniyor...</p>
                </>
              )}
            </div>
          ) : phase === 'questions' && questions && questions.length === 0 ? (
            // "Sorulara Geç" kısayolu, konunun hiç sorusu olmadığı bir durumda da (eskiden
            // sadece tebrik ekranından erişilebildiği için görünmeyen bir hal) buraya
            // gelebiliyor.
            <div className="relative flex flex-1 min-h-0 items-center justify-center px-6 text-center">
              <p className="text-sm font-bold text-slate-400">Bu konu için henüz soru eklenmemiş.</p>
            </div>
          ) : inBatchResult && questions ? (
            // Tur (10 soru) bitti — bilgilendirme + "Yeni 10 Soru Çöz" (kullanıcının 2026-09-22 ve
            // 2026-09-26 istekleri). Bilinçli olarak küçük: asıl akış slayt/sunum.
            (() => {
              const correctCount = questions.filter((q) => answeredMap[q.id] === 'correct').length;
              const pct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
              const guestTotal = guestPool?.length ?? 0;
              const guestSeen = Math.min(guestBatchStart + questions.length, guestTotal);
              return (
                <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-8 text-center">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                  >
                    <Trophy className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-500">Test bitti! {pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '🌱'}</p>
                    <p className="mt-1 text-3xl font-black text-slate-800" style={slideTextStyle(1.875, 1.2)}>
                      {correctCount} / {questions.length} <span className="text-lg text-slate-400">doğru</span>
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-500">%{pct} başarı</p>
                  </div>
                  {guestPool ? (
                    <p className="max-w-xs text-xs font-bold text-slate-400">
                      {nextGuestStart === 0
                        ? `Bu konudaki ${guestTotal} sorunun hepsini çözdünüz — yeni tur baştan başlar.`
                        : `${guestTotal} sorudan ${guestSeen} tanesini çözdünüz, sıradaki 10 soru hazır.`}
                    </p>
                  ) : questionsAllCaughtUp ? (
                    <p className="max-w-xs text-xs font-bold text-slate-400">
                      Bu konudaki tüm soruları şu an için tamamladın — yeni tur, tekrar vakti en yakın sorularla gelir.
                    </p>
                  ) : (
                    <p className="max-w-xs text-xs font-bold text-emerald-600">✓ Sonuçların kaydedildi, sıradaki 10 soru seni bekliyor.</p>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={startNewBatch}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-black text-white shadow-lg transition-transform hover:scale-105"
                      style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                    >
                      Yeni 10 Soru Çöz →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBatchResult(false);
                        setPhase('slides');
                        setAnimKey((k) => k + 1);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
                    >
                      Slaytlara Dön
                    </button>
                  </div>
                </div>
              );
            })()
          ) : phase === 'questions' && questions ? (
            <QuestionStack
              questions={questions}
              qIndex={qIndex}
              attempt={questionsAttempt}
              mountedQIndexes={runner.mountedQIndexes}
              answeredMap={answeredMap}
              timedOutIds={runner.timedOutIds}
              timeLeft={runner.timeLeft}
              fontScale={fontScale}
              onAnswered={runner.handleAnswered}
            />
          ) : slide.kind === 'cover' ? (
            <div
              className="relative flex flex-1 min-h-0 items-center gap-6 overflow-y-auto px-6 sm:px-12 py-4 sm:py-2"
              style={{ background: `linear-gradient(135deg, ${accent.from}22, white 55%)` }}
            >
              <div className={slide.imageUrl ? 'relative z-[1] flex-1 min-w-0' : 'relative z-[1] w-full'}>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 leading-tight" style={slideTextStyle(1.875, 1.15)}>{slide.heading}</h1>
                {slide.subtitle && <p className="mt-3 text-base text-slate-500 font-medium max-w-xl" style={slideTextStyle(1, 1.4)}>{slide.subtitle}</p>}
              </div>
              {slide.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setLightbox({ kind: 'image', src: slide.imageUrl! })}
                  className="group relative z-[1] hidden sm:flex h-[72%] aspect-square shrink-0 items-center justify-center rounded-2xl p-1.5 shadow-lg cursor-zoom-in"
                  style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-white p-3">
                    <img src={slide.imageUrl} alt={slide.heading} className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <ZoomIn className="absolute bottom-2 right-2 h-6 w-6 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ) : (
                <div className="animate-float-slow relative z-[1] hidden sm:flex h-[65%] aspect-square shrink-0 items-center justify-center opacity-90">
                  <DecorativePattern seed={index + 1} from={accent.from} to={accent.to} />
                </div>
              )}
            </div>
          ) : (
            <div className="relative flex flex-1 min-h-0 flex-col px-4 sm:px-8 pt-2 pb-4 sm:pb-8">
              <h2 className="text-lg sm:text-2xl font-black text-slate-800 mb-3 sm:mb-5 shrink-0" style={slideTextStyle(1.5, 1.25)}>{slide.heading}</h2>
              <div className={`relative z-[1] flex flex-1 min-h-0 gap-4 ${!imageOnRight ? 'flex-row-reverse' : ''}`}>
                {/* Madde listesi büyük font'ta sığmayabilir — eskiden zoom kartın dışına taşırıp
                    kırpıyordu, artık kendi içinde dikey kayabiliyor (kullanıcının 2026-09-21
                    "scroll ekle" isteği). */}
                {/* justify-center + overflow-y-auto birlikte kullanılınca taşan ilk madde(ler)
                    scroll alanının ÜSTÜNE (görünmeyen tarafa) denk geliyordu — kullanıcı ilk
                    maddenin "kaybolduğunu" düşünüyordu (2026-09-21). justify-start ile liste
                    her zaman baştan görünür, kısa listelerde de üstte başlaması kabul edilebilir
                    bir görünüm. Bu liste artık sadece MASAÜSTÜ (sm+) — mobil için aşağıdaki
                    tek-madde görünümüne bakın. */}
                <div className="hidden sm:flex flex-1 min-w-0 flex-col gap-2.5 justify-start overflow-y-auto py-1">
                  {slide.bullets.length ? (
                    slide.bullets.map((bullet, i) => {
                      const revealed = i < revealedCount;
                      const isNextUp = i === revealedCount;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => revealUpTo(i)}
                          disabled={revealed}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all duration-300 ${
                            revealed
                              ? 'opacity-100 translate-y-0 shadow-sm'
                              : isNextUp
                                ? 'opacity-40 cursor-pointer hover:opacity-70'
                                : 'opacity-0 -translate-y-1.5 pointer-events-none'
                          }`}
                          style={{
                            borderColor: revealed ? `${accent.bar}33` : 'transparent',
                            background: revealed ? `linear-gradient(90deg, ${accent.soft}, white)` : 'transparent',
                          }}
                        >
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow"
                            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-700 leading-snug" style={slideTextStyle(0.875, 1.4)}>{bullet}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm italic text-slate-400">İçerik özetlenemedi</p>
                  )}
                </div>

                {/* Mobil: maddeler artık alt alta BİRİKMİYOR — her dokunuşta ("İleri"/swipe,
                    ikisi de goNext'e bağlı) sadece o an açık olan TEK madde, büyük ve
                    ortalanmış yazıyla tam ekran gösteriliyor. revealedCount zaten "kaçıncı
                    madde açıldı" sayacı (masaüstündeki kademeli açılmayla AYNI state) — burada
                    "şu an gösterilecek madde" olarak yeniden kullanılıyor. Bu, tek maddelik
                    slaytlarda ekranın bomboş/yazının cılız görünmesi sorununu da çözüyor
                    (kullanıcının 2026-09-22 şikayeti): artık kaç madde olursa olsun mobilde
                    her zaman TEK bir madde, ekranı dolduracak boyutta gösteriliyor. */}
                <div className="flex sm:hidden flex-1 min-w-0 flex-col items-center justify-center gap-4 px-2 text-center">
                  {slide.bullets.length ? (
                    (() => {
                      const i = Math.min(revealedCount - 1, slide.bullets.length - 1);
                      return (
                        <>
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow"
                            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                          >
                            {i + 1}
                          </span>
                          <p className="text-lg font-bold leading-snug text-slate-700" style={slideTextStyle(1.25, 1.5)}>
                            {slide.bullets[i]}
                          </p>
                          {slide.bullets.length > 1 && (
                            <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                              {i + 1} / {slide.bullets.length}
                            </span>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <p className="text-sm italic text-slate-400">İçerik özetlenemedi</p>
                  )}
                </div>

                <div
                  className="hidden sm:flex w-[38%] shrink-0 items-center justify-center rounded-2xl p-1.5 overflow-hidden shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${accent.from}30, ${accent.to}18)` }}
                >
                  {visualSrc ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ kind: 'image', src: visualSrc })}
                      className="group relative h-full w-full flex items-center justify-center rounded-xl bg-white p-3 cursor-zoom-in overflow-hidden"
                    >
                      <img src={visualSrc} alt={slide.heading} className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                      <ZoomIn className="absolute bottom-2 right-2 h-5 w-5 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ) : cleanSvg ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ kind: 'svg', html: cleanSvg })}
                      className="group relative h-full w-full flex items-center justify-center rounded-xl bg-white p-3 cursor-zoom-in overflow-hidden"
                    >
                      <div
                        className="h-full w-full transition-transform duration-300 group-hover:scale-105 [&_svg]:h-full [&_svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: cleanSvg }}
                      />
                      <ZoomIn className="absolute bottom-2 right-2 h-5 w-5 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 opacity-80">
                      <DecorativePattern seed={index + 1} from={accent.from} to={accent.to} />
                    </div>
                  )}
                </div>
              </div>
              {showTip && deck.tip && (
                <div className="relative z-[1] mt-3 shrink-0 rounded-xl border border-[#F5C453] bg-gradient-to-r from-[#FFF7E6] to-[#FFEFC9] px-3 sm:px-4 py-2 sm:py-3 text-xs shadow-sm" style={slideTextStyle(0.75, 1.35)}>
                  <span className="font-black text-amber-800">💡 {deck.tip.title}: </span>
                  <span className="text-amber-900">{deck.tip.content}</span>
                </div>
              )}
            </div>
          )}

          {/* İleri/geri okları artık ekranın kenarlarında havada değil, slaydın kendi alt
              çubuğunda — nokta göstergesiyle aynı satırda (kullanıcının 2026-09-21 isteği).
              Mini özet ekranında (showBatchResult) bu satırın hiç anlamı yok — o ekranın
              kendi "Yeni 10 Soru Çöz"/"Slaytlara Dön" butonları var. */}
          {!inBatchResult && (
          <div className={PLAYER_NAV_ROW_CLASS}>
            <button
              type="button"
              onClick={goPrev}
              disabled={phase === 'slides' && index === 0}
              aria-label="Önceki"
              className={NAV_BTN_CLASS}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            {phase === 'questions' && questions ? (
              // Kayan numara penceresi (10 görünür, ‹/› 5'er kaydırır) — bkz. QuestionPills.
              <QuestionPills
                questions={questions}
                qIndex={qIndex}
                answeredMap={answeredMap}
                pillStart={runner.pillStart}
                setPillStart={runner.setPillStart}
                onJump={jumpTo}
                accentBar={accent.bar}
              />
            ) : phase !== 'outro' ? (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {deck.slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => jumpTo(i)}
                    aria-label={`${i + 1}. slayta git`}
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: i === index ? '1.75rem' : '0.5rem',
                      background: i === index ? `linear-gradient(90deg, ${accent.from}, ${accent.to})` : inactiveDotColor,
                    }}
                  />
                ))}
              </div>
            ) : null}

            {phase === 'questions' && questions && qIndex === questions.length - 1 ? (
              // Turun son sorusu: ok yerine açık bir "Bitir" — özet ekranına geçtiği belli olsun.
              <button
                type="button"
                onClick={goNext}
                disabled={answeredMap[questions[qIndex]?.id] == null}
                className="shrink-0 rounded-full px-4 py-2 text-xs sm:text-sm font-black text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
                style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
              >
                Bitir ({Object.keys(answeredMap).length}/{questions.length})
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                // 'slides' fazında son slayttan sonra "İleri" tebrik ekranına geçer, kilitlenmez.
                disabled={phase === 'outro' ? !questions || questions.length === 0 : phase === 'questions' ? !questions : false}
                aria-label="Sonraki"
                className={NAV_BTN_CLASS}
              >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            )}
          </div>
          )}
      </PlayerFrame>

      {lightbox && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-6 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          {lightbox.kind === 'image' ? (
            <img src={lightbox.src} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          ) : (
            <div
              className="max-h-[85vh] w-[min(90vw,42rem)] overflow-auto rounded-lg bg-white p-6 shadow-2xl [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: lightbox.html }}
            />
          )}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Kapat"
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}
