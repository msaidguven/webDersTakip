'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, ListChecks, Loader2, Maximize2, Minimize2, Minus, PartyPopper, Plus, Trophy, X, ZoomIn } from 'lucide-react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';
import { QuestionAnswerKeyItem } from '@/app/src/components/QuizClient';
import { MAX_QUESTIONS_PER_TEST, type QuizQuestion } from '@/app/src/lib/quizQuestions';
import { useAuth } from '@/app/src/context/AuthContext';

// Her "section" slaydına, sırayla değişen bir renk teması atanıyor — konu boyunca hep aynı
// mor tonu görmek yerine slayttan slayta renk değişimi, aynı içeriğin tek düze/sıkıcı
// hissetmesini engelliyor. Marka rengi (#6C63FF) hâlâ chrome/navigasyonda sabit kalıyor,
// bu palet slayt içeriğinde (madde rozeti, gradyan şerit, dekoratif şekiller, görsel çerçevesi).
const ACCENTS = [
  { bar: '#6C63FF', from: '#8B7FFF', to: '#5B4FE0', soft: '#EDEBFF', glow: 'rgba(108,99,255,0.5)' },
  { bar: '#0FA37F', from: '#3FD9AE', to: '#0C8468', soft: '#E1F8F0', glow: 'rgba(15,163,127,0.5)' },
  { bar: '#E0862A', from: '#FBBB55', to: '#C86A0E', soft: '#FEF0DD', glow: 'rgba(224,134,42,0.5)' },
  { bar: '#2B7FD9', from: '#63B0F0', to: '#1B5FAE', soft: '#E4F0FD', glow: 'rgba(43,127,217,0.5)' },
] as const;

// Akıllı tahtadan uzaktaki öğrenciler için metin boyutu ayarı — sadece bu oturumda geçerli,
// kaydedilmiyor (kullanıcının 2026-09-21 isteği).
//
// NOT: bir ara CSS pixel genişliğine (ResizeObserver ile ölçülen viewport/kart genişliği)
// göre OTOMATİK büyüten bir "ekran boyutu" tahmini denendi, ama tarayıcı sadece CSS pixel
// sayısını görüyor — bu, FİZİKSEL ekran boyutuyla ilgili değil (27" 1440p bir monitör bile
// 1280px'i rahatça aşıyor). Sonuç: normal masaüstü ekranlarda da gereksiz yere büyütüp
// taşırıyordu (kullanıcının 2026-09-21 bulduğu regresyon). Kaldırıldı — büyütme sadece
// kullanıcının elle bastığı +/- ile oluyor.
const MIN_FONT_SCALE = 1;
const MAX_FONT_SCALE = 5;
const FONT_SCALE_STEP = 0.25;

// Soru fazındaki numara şeridi kayan bir pencere: her zaman 10 numara görünür, ‹/› butonları
// pencereyi 5'er kaydırır (1-10, sonra 5-15, ...) — kullanıcının 2026-09-22 isteği.
const PILL_WINDOW_SIZE = 10;
const PILL_PAGE_STEP = 5;

// Soru başına süre — dolunca soru otomatik yanlış sayılır (kullanıcının 2026-09-24 isteği).
const QUESTION_TIME_LIMIT_SECONDS = 60;

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Görsel (img) ile diyagram (ham SVG markup) farklı şekilde render edildiği için (biri
  // <img src>, diğeri dangerouslySetInnerHTML) lightbox'ın ikisini de büyütebilmesi için tip
  // ayrımı gerekiyor.
  const [lightbox, setLightbox] = useState<{ kind: 'image'; src: string } | { kind: 'svg'; html: string } | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  // Mobilde parmakla kaydırarak slayt/soru değiştirme — dokunuşun başlangıç noktasını tutuyor,
  // touchend'de yatay mesafe dikeyden belirgin şekilde büyükse (aksi halde soru ekranındaki
  // dikey scroll ile karışır) goNext/goPrev tetikleniyor. Bir maddeye tıklamak (neredeyse sıfır
  // hareket) swipe eşiğinin altında kaldığı için karışmıyor — "önce tıkla aç, sonra kaydırarak
  // geç" davranışı goNext/goPrev'in kendi mantığı sayesinde otomatik korunuyor (kullanıcının
  // 2026-09-21 isteği).
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Slaytlar bitince ('outro') tebrik ekranı, sonra istenirse ('questions') konunun soru
  // bankası aynı tam ekran kabukta, slayt slayt (1 soru/slayt) gösteriliyor.
  const [phase, setPhase] = useState<'slides' | 'outro' | 'questions'>('slides');
  const [qIndex, setQIndex] = useState(0);
  const [pillStart, setPillStart] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  // API, giriş yapmış kullanıcıda TÜM soruları değil kişiselleştirilmiş 10'luk bir parti
  // döndürüyor (bkz. /api/topics/[topicId]/all-questions, kullanıcının 2026-09-22 isteği) —
  // personalized bunu ayırt etmek için (misafirde false, tüm sorular gelir), allCaughtUp
  // "havuzda şu an çözülmeye uygun hiçbir soru kalmadı" (hepsi ustalaşılmış) durumunu mini
  // özet ekranında bir not olarak göstermek için.
  const [questionsPersonalized, setQuestionsPersonalized] = useState(false);
  const [questionsAllCaughtUp, setQuestionsAllCaughtUp] = useState(false);
  // Kişiselleştirilmiş 10'luk parti bitince ("Bitir"e basılınca) mini bir özet ekranı
  // gösterip "Yeni 10 Soru Çöz" ile bir sonraki partiye geçilebiliyor — phase 'questions'
  // olarak kalıyor, sadece bu bayrak soru kartı yerine özet kartını render ettiriyor (yeni
  // bir phase değeri açıp header/nav'daki onlarca `phase !== 'outro'` kontrolünü tek tek
  // güncellemek yerine).
  const [showBatchResult, setShowBatchResult] = useState(false);
  // Geri gidince önceki tıklamalar kaybolmasın diye soru component'leri hiç unmount
  // edilmiyor (bkz. questions.map aşağıda) — bu map "D:/Y:" sayacı için; ayrıca giriş yapmış
  // kullanıcıda aşağıdaki recordAnswer'ı tetikleyen onAnswered de aynı map'i dolduruyor.
  const [answeredMap, setAnsweredMap] = useState<Record<number, 'correct' | 'incorrect' | 'revealed'>>({});
  const [questionsAttempt, setQuestionsAttempt] = useState(0);

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
  // Her soru KaTeX ile matematik render ediyor (bkz. topicContentV11.renderPlainTextMath) —
  // hepsini "Soruları Çöz"de tek seferde mount edersek (eskiden öyleydi) konu 20-30 soruluksa
  // ana thread'i bloke edip sunumu donmuş gibi hissettiriyordu (kullanıcının 2026-09-21
  // bulduğu yavaşlık). Bunun yerine sadece o ana kadar GÖRÜLMÜŞ sorular mount ediliyor —
  // "geri gidince tıklamalarım kaybolmasın" davranışı bozulmadan (görülen soru bir daha
  // unmount edilmiyor), sadece henüz görülmemiş sorular ilk kez sıraya gelene kadar hiç
  // render edilmiyor.
  const [mountedQIndexes, setMountedQIndexes] = useState<Set<number>>(() => new Set());
  // Aktif sorunun geri sayımı (60sn) — süre dolunca handleQuestionAnswered ile 'incorrect'
  // olarak işaretlenip ilgili soru timedOutIds'e eklenir (bkz. aşağıdaki iki efekt).
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT_SECONDS);
  const [timedOutIds, setTimedOutIds] = useState<Set<number>>(new Set());

  // Deck/konu değişince (embedded SlidePlayer sayfada sabit kalıp deck prop'u değiştiği için)
  // her şeyi baştan başlat — aksi halde önceki konunun ortasında/sorularında kalınırdı.
  useEffect(() => {
    setIndex(0);
    setRevealedCount(1);
    setPhase('slides');
    setQIndex(0);
    setQuestions(null);
    setQuestionsError(null);
    setQuestionsPersonalized(false);
    setQuestionsAllCaughtUp(false);
    setShowBatchResult(false);
    setAnsweredMap({});
    setMountedQIndexes(new Set());
    setTimedOutIds(new Set());
    setAnimKey((k) => k + 1);
    setQuizSessionId(null);
    setHasAnsweredOnceInSlides(false);
    quizSessionQuestionsKeyRef.current = null;
    quizPendingAnswersRef.current = [];
  }, [topicId]);

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

    supabase
      .rpc('start_web_quiz_session', {
        p_client_id: quizClientIdRef.current,
        p_grade_id: gradeId,
        p_lesson_id: lessonId,
        p_unit_id: unitId,
        p_topic_id: topicId,
        p_question_ids: assignedQuestionIds,
      })
      .then(({ data, error }: { data: number | null; error: { message: string } | null }) => {
        if (error) {
          console.error('start_web_quiz_session error:', error.message);
          return;
        }
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
    supabase
      .from('test_session_answers')
      .insert(
        toFlush.map((a) => ({
          test_session_id: quizSessionId,
          question_id: a.questionId,
          user_id: user.id,
          client_id: quizClientIdRef.current,
          is_correct: a.isCorrect,
          duration_seconds: a.durationSeconds,
        }))
      )
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('test_session_answers flush error:', error.message);
      });
    // user (nesne) yerine user?.id: Supabase TOKEN_REFRESHED gibi olaylarda user nesnesi aynı
    // kullanıcı için bile yeni bir referansla gelir — bkz. QuizClient'taki aynı gerekçe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizSessionId, user?.id, supabase]);

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
      supabase
        .from('test_session_answers')
        .insert({
          test_session_id: quizSessionId,
          question_id: questionId,
          user_id: user.id,
          client_id: quizClientIdRef.current,
          is_correct: isCorrect,
          duration_seconds: durationSeconds,
        })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.error('test_session_answers insert error:', error.message);
        });
    },
    // user (nesne) yerine user?.id — bkz. yukarıdaki flush efektindeki aynı gerekçe. Bu
    // fonksiyonun referansı sabit kalmalı ki aşağıdaki handleQuestionAnswered (ve dolayısıyla
    // memo'lu QuestionAnswerKeyItem) gereksiz yere değişmesin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAuthenticated, user?.id, hasAnsweredOnceInSlides, quizSessionId, supabase]
  );

  // Tüm mount'lu QuestionAnswerKeyItem'lara AYNI referansla geçiliyor (bkz. yukarıdaki
  // memo notu) — inline bir arrow function yerine burada tanımlanması, soru cevaplanınca
  // sadece o soru değil, önceden görülmüş/hidden tüm sorular da yeniden render edilip
  // "donuk/yavaş" hissettirmesin diye (kullanıcının 2026-09-22 şikayeti).
  const handleQuestionAnswered = useCallback(
    (id: number, status: 'correct' | 'incorrect' | 'revealed') => {
      setAnsweredMap((m) => ({ ...m, [id]: status }));
      // Klasik (açık uçlu) soru bu havuzda hiç yok (question_type_id=4 hariç tutuluyor),
      // yani 'revealed' burada pratikte oluşmaz — yine de güvenlik için sadece
      // correct/incorrect istatistiğe yazılır.
      if (status === 'correct' || status === 'incorrect') {
        recordSlideQuizAnswer(id, status === 'correct');
      }
    },
    [recordSlideQuizAnswer]
  );

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
        setQuestions((data.questions as QuizQuestion[]) || []);
        setQuestionsPersonalized(!!data.personalized);
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
    setQIndex(0);
    setAnsweredMap({});
    setShowBatchResult(false);
    setMountedQIndexes(new Set([0]));
    setTimedOutIds(new Set());
    setQuestionsAttempt((a) => a + 1);
    setAnimKey((k) => k + 1);
  }, []);

  // Kişiselleştirilmiş 10'luk parti bitince mini özet ekranındaki "Yeni 10 Soru Çöz" —
  // questions'ı null'a çekmek fetch efektini yeniden tetikler (o efekt sadece questions===null
  // iken çalışıyor); artık her cevap user_question_stats'a işlendiği için API'nin bir
  // sonraki çağrısı doğal olarak farklı (yeni öncelikli) bir 10'luk parti döndürür — ayrıca
  // bir "offset" bilgisi tutmaya gerek yok.
  const startNewBatch = useCallback(() => {
    setQuestions(null);
    setQuestionsError(null);
    startQuestions();
  }, [startQuestions]);

  const goPrev = useCallback(() => {
    if (phase === 'questions') {
      if (qIndex > 0) setQIndex((q) => q - 1);
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
  }, [phase, qIndex]);

  const goNext = useCallback(() => {
    if (phase === 'questions') {
      if (questions && qIndex < questions.length - 1) {
        setQIndex((q) => q + 1);
        setAnimKey((k) => k + 1);
        return;
      }
      // Son soru: kişiselleştirilmiş (giriş yapmış) 10'luk partide, son soru da
      // cevaplandıysa "Bitir"e basmak mini özet ekranını açar. Misafirde (tüm sorular,
      // kişiselleştirme yok) bu adım hiç yok — eskisi gibi son soruda hiçbir şey olmaz.
      if (questionsPersonalized && questions && answeredMap[questions[qIndex]?.id] != null) {
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
  }, [phase, qIndex, questions, bulletsLeft, index, total, startQuestions, questionsPersonalized, answeredMap]);

  const jumpTo = useCallback((i: number) => {
    if (phase === 'questions') {
      setQIndex(i);
    } else {
      setIndex(i);
      setRevealedCount(1);
    }
    setAnimKey((k) => k + 1);
  }, [phase]);

  // Kilitli (henüz açılmamış) bir maddeye tıklayınca o maddeye kadar hepsini aç — "İleri"ye
  // art arda basmak yerine öğretmen/öğrenci istediği maddeye doğrudan atlayabilsin.
  const revealUpTo = useCallback((bulletIndex: number) => {
    setRevealedCount((c) => Math.max(c, bulletIndex + 1));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Eskiden kaydırma (swipe) bir slaytın KALAN TÜM maddelerini birden açıyordu ("bu slaytla
  // işim bitti, sıradakine geç" niyeti) — ama mobilde artık her adımda TEK madde tam ekran
  // gösteriliyor (kullanıcının 2026-09-22 isteği), bu yüzden swipe da tıklama/"İleri" ile
  // AYNI tek-adım mantığına (goNext) bağlandı; aksi halde bir kaydırma mobildeki tüm madde
  // sayfalarını atlayıp doğrudan slaydın sonuna zıplardı.
  const SWIPE_MIN_DISTANCE = 48;
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || lightbox) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) goNext();
    else goPrev();
  }, [lightbox, goNext, goPrev]);

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
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [isOverlay, onClose, goPrev, goNext, lightbox]);

  useEffect(() => {
    if (phase !== 'questions') return;
    setMountedQIndexes((prev) => (prev.has(qIndex) ? prev : new Set(prev).add(qIndex)));
  }, [phase, qIndex]);

  // Soru değişince (ya da yeni bir "Soruları Çöz" denemesi başlayınca) sayaç 60'tan yeniden
  // başlar.
  useEffect(() => {
    setTimeLeft(QUESTION_TIME_LIMIT_SECONDS);
  }, [qIndex, questionsAttempt]);

  // Her saniye azaltır — aktif soru zaten cevaplanmış/süresi dolmuşsa (ör. geri gidip
  // önceden çözülmüş bir soruya bakılıyorsa) hiç çalışmaz.
  useEffect(() => {
    if (phase !== 'questions' || showBatchResult || !questions) return;
    const current = questions[qIndex];
    if (!current || answeredMap[current.id] != null || timedOutIds.has(current.id)) return;
    if (timeLeft <= 0) {
      setTimedOutIds((prev) => new Set(prev).add(current.id));
      handleQuestionAnswered(current.id, 'incorrect');
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, showBatchResult, questions, qIndex, timeLeft, answeredMap, timedOutIds, handleQuestionAnswered]);

  // İleri/geri okuyla ya da swipe ile soru değiştirildiğinde, o soru şu an görünen 10'luk
  // pencerenin dışına çıktıysa numara şeridi de otomatik o soruyu içeren pencereye kayar —
  // aksi halde "Sonraki"ye basınca aktif soru numarası şeritte görünmeyen bir yerde kalırdı.
  // Pencere hâlâ görünürdeyse dokunmuyor, aksi halde << >> ile elle gezinirken her soru
  // değişiminde pencere sıfırlanırdı.
  useEffect(() => {
    if (phase !== 'questions' || !questions) return;
    setPillStart((s) => {
      if (qIndex >= s && qIndex < s + PILL_WINDOW_SIZE) return s;
      const maxStart = Math.max(0, questions.length - PILL_WINDOW_SIZE);
      return Math.min(maxStart, Math.floor(qIndex / PILL_PAGE_STEP) * PILL_PAGE_STEP);
    });
  }, [phase, qIndex, questions]);

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
  const navBtnClass = 'bg-slate-900/60 text-white hover:bg-slate-900/80 shadow-sm';
  const iconBtnClass = 'bg-slate-900/60 text-white hover:bg-slate-900/80 shadow-sm';
  // Nokta göstergesi artık her zaman beyaz kartın İÇİNDE (eskiden overlay'de kartın altında,
  // koyu arka plan üstündeydi) — bu yüzden isOverlay'e göre değil, her zaman açık zeminde
  // okunan tonda (kullanıcının 2026-09-21 isteğiyle oklar/noktalar slayda taşındı).
  const inactiveDotColor = 'rgba(15,23,42,0.18)';

  return (
    <div
      ref={containerRef}
      className={
        isOverlay
          ? 'fixed inset-0 z-[999] flex items-center justify-center p-0 sm:p-6 transition-colors duration-700'
          : 'relative flex items-center justify-center transition-colors duration-700'
      }
      style={
        isOverlay
          ? { background: `radial-gradient(circle at 50% 20%, ${accent.glow}, transparent 55%), rgba(15, 23, 42, 0.94)` }
          : undefined
      }
    >
      {/* Embedded (ders sayfasına gömülü) varyant eskiden max-w-6xl (1152px) gibi SABİT bir
          üst sınırdaydı — büyük ekranlarda, DersClient'ın zaten orantılı büyüyen ana içerik
          sütunu (bkz. o dosyadaki `1fr` grid kolonu) çok daha geniş olsa bile slayt küçük
          kalıp etrafı boş bırakıyordu (kullanıcının 2026-09-22 "ekran büyürse en az %80-90
          genişlesin" isteği). Artık sabit bir üst sınır YOK — genişlik tamamen üst kapsayıcı
          sütuna bırakılıyor, o zaten ekran büyüdükçe orantılı büyüyor. */}
      <div className="flex flex-col items-center gap-3 w-full">
        <div
          key={cardKey}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={
            // Overlay'de kart 16:9 oranını SIKI SIKIYA koruyordu (min(94vw,94dvh*16/9) /
            // min(94dvh,94vw*9/16) çifti) — akıllı tahtalarda tarayıcı penceresi 16:9'dan
            // biraz daha "kısa/geniş" kaldığında (üst çubuk/araç çubuğu dvh'den düşünce)
            // yükseklik kısıtlayıcı eksen oluyor, genişlik de oranı korumak için küçülüp
            // kartın İKİ YANINDA kocaman beyaz boşluk bırakıyordu (kullanıcının akıllı tahta
            // fotoğrafıyla gösterdiği sert şikayet: "neden ortaya sıkışmış, kenarda boşluk
            // var"). Oran kilidini tamamen kaldırıp genişlik/yükseklik BAĞIMSIZ olarak
            // ekranın büyük kısmını dolduruyor — içerik buna göre esniyor.
            isOverlay
              ? 'animate-slide-pop-in relative flex w-full h-[calc(100dvh-4.5rem)] sm:h-[92dvh] sm:w-[92vw] flex-col overflow-hidden rounded-none sm:rounded-2xl bg-white shadow-2xl'
              : 'animate-slide-pop-in relative flex w-full aspect-[16/10] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'
          }
        >
          {/* Dekoratif, dolaşan renkli blob'lar — kartın arka planına derinlik katıyor */}
          <div
            className="animate-blob-drift pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent.from}55, transparent 70%)` }}
          />
          <div
            className="animate-blob-drift pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent.to}40, transparent 70%)`, animationDelay: '2.5s' }}
          />

          <div className="absolute inset-x-0 top-0 h-2 transition-colors duration-500" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />

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
          <div className="relative z-10 flex shrink-0 flex-col gap-2 px-3 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-5">
            <div className="min-w-0 w-full sm:w-auto">
              {deck.eyebrowText && (
                <div
                  className="block max-w-full truncate rounded-lg px-2.5 py-1.5 text-[9px] sm:inline-block sm:text-[11px] font-black uppercase tracking-wide text-white shadow-sm"
                  style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
                >
                  {deck.eyebrowText}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              {phase !== 'outro' && !showBatchResult && (
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
                  {/* Akıllı tahtadan uzaktaki öğrenciler için metin büyütme/küçültme — sadece bu
                      oturumda geçerli, kaydedilmiyor. */}
                  <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/90 px-1 py-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setFontScale((s) => Math.max(MIN_FONT_SCALE, Math.round((s - FONT_SCALE_STEP) * 100) / 100))}
                      disabled={fontScale <= MIN_FONT_SCALE}
                      aria-label="Metni küçült"
                      title="Metni küçült"
                      className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    {/* Eskiden sabit w-7 (28px) genişlikteydi — yazı da +/- ile birlikte
                        büyüyünce (bkz. smallBadgeStyle) %250'de metin bu sabit kutuya
                        sığmayıp yan butonların ÜSTÜNE taşıyor, onları görünmez kılıyordu
                        (kullanıcının 2026-09-22 bulduğu bug). min-w-7 ile taban genişlik
                        korunuyor ama metin büyüdükçe kutu da otomatik genişliyor, komşu
                        butonların üstüne binmiyor. */}
                    <span className="min-w-7 px-0.5 text-center text-[9px] sm:text-[10px] font-black text-slate-500 whitespace-nowrap" style={smallBadgeStyle(10)}>%{Math.round(fontScale * 100)}</span>
                    <button
                      type="button"
                      onClick={() => setFontScale((s) => Math.min(MAX_FONT_SCALE, Math.round((s + FONT_SCALE_STEP) * 100) / 100))}
                      disabled={fontScale >= MAX_FONT_SCALE}
                      aria-label="Metni büyüt"
                      title="Metni büyüt (akıllı tahta için)"
                      className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {phase === 'questions' && (
                    <div className="hidden rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black shadow-sm sm:block" style={smallBadgeStyle(11)}>
                      <span className="text-emerald-600">D:{Object.values(answeredMap).filter((v) => v === 'correct').length}</span>
                      {' '}
                      <span className="text-rose-500">Y:{Object.values(answeredMap).filter((v) => v === 'incorrect').length}</span>
                    </div>
                  )}
                  <div className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black text-slate-500 shadow-sm" style={smallBadgeStyle(11)}>
                    {phase === 'questions' ? `${qIndex + 1}/${questions?.length ?? '…'}` : `${index + 1}/${total}`}
                  </div>
                </>
              )}
              {isOverlay ? (
                <>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran sunum modu'}
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-colors ${iconBtnClass}`}
                  >
                    {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Kapat"
                    className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-colors ${iconBtnClass}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
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
              <p className="relative z-[1] max-w-md text-xs sm:text-base font-medium text-slate-500" style={slideTextStyle(1, 1.4)}>
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
          ) : phase === 'questions' && showBatchResult && questions ? (
            // Kişiselleştirilmiş 10'luk parti bitti — mini bir özet + "Yeni 10 Soru Çöz"
            // (kullanıcının 2026-09-22 isteği). Tam ekran sonuç ekranı (QuizClient'taki gibi)
            // yerine bilinçli olarak küçük tutuldu: burada asıl akış slayt/sunum, testin
            // kendisi değil.
            <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
                style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
              >
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <p className="text-2xl font-black text-slate-800">
                {questions.filter((q) => answeredMap[q.id] === 'correct').length} / {questions.length} doğru
              </p>
              {questionsAllCaughtUp && (
                <p className="max-w-xs text-xs font-bold text-slate-400">
                  Bu konudaki tüm soruları şu an için tamamladın — yeni bir parti, tekrar vakti en yakın sorularla gelir.
                </p>
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
                    setPhase('slides');
                    setAnimKey((k) => k + 1);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
                >
                  Slaytlara Dön
                </button>
              </div>
            </div>
          ) : phase === 'questions' && questions ? (
            <div className="relative flex flex-1 min-h-0 flex-col px-4 sm:px-8 pt-1 pb-4 sm:pb-8 overflow-y-auto">
              {/* Sorular hiç unmount edilmiyor — sadece görünürlük değişiyor. Aksi halde
                  geri/ileri gidince QuestionAnswerKeyItem'ın kendi state'i (seçim/reveal)
                  sıfırlanırdı (kullanıcının 2026-09-21 isteği: "geri gittiğimde önceki
                  tıklamalarım kaybolmasın"). key={questionsAttempt} sadece "Soruları Çöz"e
                  yeniden basılınca hepsini sıfırdan başlatıyor.
                  NOT: burada artık `zoom` KULLANILMIYOR — zoom, metinle birlikte şık
                  butonlarının padding/gap/genişliğini de büyütüp ekranı taşırıyordu
                  (kullanıcının 2026-09-21 bulduğu regresyon). Bunun yerine fontScale doğrudan
                  QuestionAnswerKeyItem'a veriliyor; o da SADECE metin font-size'ını
                  büyütüyor, buton dolgusu/genişliği sabit kalıyor. */}
              {questions.map((q, i) => {
                if (!mountedQIndexes.has(i)) return null;
                const isTimedOut = timedOutIds.has(q.id);
                const isActiveUnanswered = i === qIndex && !answeredMap[q.id] && !isTimedOut;
                return (
                  <div
                    key={`${questionsAttempt}-${q.id}`}
                    // Eskiden max-w-4xl ile ortalanıyordu — slayt içeriği (bkz. yukarıdaki
                    // section/cover blokları) her zaman kartın kenarlarına kadar (px-4/px-8
                    // dolgu hariç) yayılıyor, ama sorular dar bir sütuna sıkışıp geniş
                    // ekranlarda iki yanda boşluk bırakıyordu (kullanıcının 2026-09-24
                    // isteği: "içerikler kenara tam yaslı ama sorular tam yaslanmamış").
                    // w-full ile artık aynı genişliği (kartın iç dolgusuna kadar) kaplıyor.
                    className={i === qIndex ? 'relative z-[1] my-auto w-full rounded-2xl border border-slate-200 bg-white/60 p-4 sm:p-6' : 'hidden'}
                  >
                    {isActiveUnanswered && (
                      <div
                        className={`mb-2.5 flex items-center justify-end gap-1.5 text-xs font-black tabular-nums ${
                          timeLeft <= 10 ? 'text-rose-500' : 'text-slate-400'
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        0:{String(timeLeft).padStart(2, '0')}
                      </div>
                    )}
                    <QuestionAnswerKeyItem
                      question={q}
                      index={i}
                      numberBadge="label"
                      // Eskiden global `accent.bar` (o an açık olan SORUYA göre) veriliyordu —
                      // bu, qIndex her değiştiğinde TÜM mount'lu (görünmeyen dahil) soruların
                      // accentColor prop'unu "değişti" gösterip memo'yu (aşağıdaki not) her
                      // soru geçişinde boşa çıkarıyordu. Kendi index'ine (i) göre sabit bir
                      // renk almak hem daha doğru (her soru hep aynı temayı korur) hem de
                      // memo'nun gerçekten işe yaraması için şart.
                      accentColor={ACCENTS[i % ACCENTS.length].bar}
                      interactive
                      fontScale={fontScale}
                      onAnswered={handleQuestionAnswered}
                      // Süre (60sn) dolunca soru cevaplanmamış sayılıp yanlış işaretlenir —
                      // forcedAnswered kilitleyip doğru şıkkı açığa çıkarır, feedbackMessage
                      // "süre doldu" uyarısını gösterir (kullanıcının 2026-09-24 isteği).
                      forcedAnswered={isTimedOut ? true : undefined}
                      answeredCorrectly={isTimedOut ? false : undefined}
                      // Eski metin ("Doğru cevap işaretlendi") yanlış anlaşılıyordu — sanki
                      // öğrenci doğru cevaplamış gibi okunabiliyordu (kullanıcının 2026-09-24
                      // bulduğu belirsizlik). Artık "yanlış sayıldın" açıkça yazıyor, doğru
                      // şıkkın aşağıda vurgulanması ayrı bir cümlede belirtiliyor.
                      feedbackMessage={isTimedOut ? '⏰ Süre doldu! Bu soru yanlış sayıldı. Doğru cevap aşağıda işaretlendi.' : undefined}
                    />
                  </div>
                );
              })}
            </div>
          ) : slide.kind === 'cover' ? (
            <div
              className="relative flex flex-1 min-h-0 items-center gap-6 overflow-y-auto px-6 sm:px-12 py-4 sm:py-2"
              style={{ background: `linear-gradient(135deg, ${accent.from}22, white 55%)` }}
            >
              <div className={slide.imageUrl ? 'relative z-[1] flex-1 min-w-0' : 'relative z-[1] w-full'}>
                <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-800 leading-tight" style={slideTextStyle(1.875, 1.15)}>{slide.heading}</h1>
                {slide.subtitle && <p className="mt-3 text-xs sm:text-base text-slate-500 font-medium max-w-xl" style={slideTextStyle(1, 1.4)}>{slide.subtitle}</p>}
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
              <h2 className="text-base sm:text-2xl font-black text-slate-800 mb-3 sm:mb-5 shrink-0" style={slideTextStyle(1.5, 1.25)}>{slide.heading}</h2>
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
                <div className="relative z-[1] mt-3 shrink-0 rounded-xl border border-[#F5C453] bg-gradient-to-r from-[#FFF7E6] to-[#FFEFC9] px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs shadow-sm" style={slideTextStyle(0.75, 1.35)}>
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
          {!showBatchResult && (
          <div className="relative z-10 flex shrink-0 items-center justify-center gap-3 sm:gap-4 px-3 pb-2.5 pt-1.5 sm:px-6 sm:pb-4 sm:pt-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={phase === 'slides' && index === 0}
              aria-label="Önceki"
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${navBtnClass}`}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            {phase === 'questions' && questions ? (
              // Soru fazında slayt sayısı çok olduğunda (20-30 soru) eskiden burada tek
              // satırda büyüyen bir nokta dizisi vardı — genişliği kısıtlanmadığı için
              // sağdaki "Sonraki" oku ekran dışına taşıp kayboluyordu (kullanıcının
              // 2026-09-22 bulduğu bug). Yatay kaydırma yerine (kullanıcının isteği: "scroll
              // niyetine << >> butonlarıyla 5'er ilerlesin, 10 tane görünsün, 1-10 sonra
              // 5-15 gibi") kayan bir pencere: her zaman PILL_WINDOW_SIZE (10) numara
              // görünür, ‹/› butonları pencereyi PILL_PAGE_STEP (5) kaydırır — ok butonları
              // (slayt ileri/geri) hep aynı yerde sabit kalıyor.
              (() => {
                const maxStart = Math.max(0, questions.length - PILL_WINDOW_SIZE);
                // Giriş yapmış kullanıcıda artık soru sayısı zaten 10'a sabit (bkz.
                // getTopicTestQuestions) — bu durumda pencere tüm soruları kapsıyor ve ‹/›
                // hiçbir şey yapmadan hep pasif duruyordu (kullanıcının 2026-09-22 şikayeti).
                // Sadece pencerenin gerçekten kaydıracağı bir şey varsa (misafirde 10'dan
                // fazla soru olan konularda) gösteriliyor.
                const hasMultiplePages = maxStart > 0;
                return (
                  <div className="flex items-center gap-1">
                    {hasMultiplePages && (
                    <button
                      type="button"
                      onClick={() => setPillStart((s) => Math.max(0, s - PILL_PAGE_STEP))}
                      disabled={pillStart === 0}
                      aria-label="Önceki sorular"
                      className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/10 disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    )}
                    <div className="flex items-center gap-1">
                      {questions.slice(pillStart, pillStart + PILL_WINDOW_SIZE).map((q, iInWindow) => {
                        const i = pillStart + iInWindow;
                        const status = answeredMap[q.id];
                        const isCurrent = i === qIndex;
                        const cls =
                          status === 'correct'
                            ? 'bg-emerald-500 text-white'
                            : status === 'incorrect'
                              ? 'bg-rose-500 text-white'
                              : status === 'revealed'
                                ? 'bg-indigo-500 text-white'
                                : 'bg-slate-900/10 text-slate-500';
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => jumpTo(i)}
                            aria-label={`${i + 1}. soruya git`}
                            className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[10px] sm:text-[11px] font-black transition-all ${cls} ${
                              isCurrent ? 'ring-2 ring-offset-1' : ''
                            }`}
                            style={isCurrent ? ({ ['--tw-ring-color' as string]: accent.bar } as React.CSSProperties) : undefined}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                    {hasMultiplePages && (
                    <button
                      type="button"
                      onClick={() => setPillStart((s) => Math.min(maxStart, s + PILL_PAGE_STEP))}
                      disabled={pillStart >= maxStart}
                      aria-label="Sonraki sorular"
                      className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/10 disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    )}
                  </div>
                );
              })()
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

            <button
              type="button"
              onClick={goNext}
              disabled={
                // 'slides' fazında son slayttan sonra "İleri" tebrik ekranına geçtiği için hiç
                // kilitlenmiyor; kilitlenme sadece soru fazlarında (soru yoksa/son sorudaysa)
                // geçerli. Kişiselleştirilmiş partide (giriş yapmış kullanıcı) son soru da
                // cevaplandıysa kilitlenmez — bu durumda "İleri" mini özet ekranını açar
                // (bkz. goNext'teki showBatchResult dalı).
                phase === 'outro' ? !questions || questions.length === 0
                  : phase === 'questions'
                    ? !questions || (qIndex === questions.length - 1 && !(questionsPersonalized && answeredMap[questions[qIndex]?.id] != null))
                    : false
              }
              aria-label={phase === 'questions' && qIndex === (questions?.length ?? 0) - 1 && questionsPersonalized ? 'Bitir' : 'Sonraki'}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${navBtnClass}`}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
          )}
        </div>
      </div>

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
    </div>
  );
}
