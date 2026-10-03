'use client';

// Soru bankası konu sayfasındaki soru LİSTESİ (2026-10-03 yenilemesi; eskiden tek soru modu +
// optik panel). Sorular alt alta kart; her kart QuestionAnswerKeyItem ile tıklanarak çözülür
// (şık seç → doğru/yanlış + açıklama, ya da "Cevabı Göster"). İlk INITIAL_VISIBLE soru açık,
// gerisi "Kalan N soruyu göster" ile açılır; soru türü filtresi var.
//
// SEO: TÜM sorular her zaman render edilir — gizli olanlar yalnız display:none (bot ve kullanıcı
// AYNI HTML'i alır, cloaking değil); JS kapalıyken <noscript> override'ı (.question-bank-item,
// bkz. [konu]/page.tsx) hepsini açar. Cevap durumu bu oturuma özel, backend'e yazılmaz (puanlı
// test TestStatusCard'da).
//
// Giriş yapmış ÖĞRENCİ yalnız testte çözdüğü soruları istatistikleriyle görür, cevap anahtarı
// açık (bkz. useQuestionBankViewer); misafir, öğretmen ve admin tüm listeyi.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Award, CheckCircle2, ChevronDown, MessageCircle, Minus, Plus, RotateCcw, X, XCircle } from 'lucide-react';
import { formatQuestionContext, type QuizQuestion } from '@/app/src/lib/quizQuestions';
import { QuestionAnswerKeyItem, TYPE_LABELS } from '@/app/src/components/QuizClient';
import QuestionCardHeader, { ShareQuestionButton } from '@/app/src/components/QuestionCardHeader';
import UnitDiscussion from '@/app/src/components/UnitDiscussion';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { FOCUS_QUESTION_EVENT } from '@/app/src/lib/soruBankasiEvents';
import { useQuestionBankViewer, type QuestionStat } from '@/app/src/hooks/useQuestionBankViewer';

// Kapatma: X / Escape / backdrop tıklaması — bkz. QuizModal.tsx'teki aynı desen
// (bu sayfada route değişmediği için o component'i doğrudan kullanamıyoruz, aynı
// davranışı burada tekrar ediyoruz: body scroll kilidi + Escape dinleyici).
function CommentsModal({ index, onClose, children }: { index: number; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col bg-surface sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-2xl sm:rounded-2xl sm:border sm:border-default"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-default bg-surface px-4 py-3 sm:rounded-t-2xl">
          <h3 className="text-sm font-black text-default">Soru {index + 1} — Yorumlar</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-elevated hover:text-default transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        {/* min-h-0, flex öğesinin içeriğine göre büyümesini engelleyip flex-1'in gerçek bir
            yükseklik sınırı olarak çalışmasını sağlıyor — bu olmadan overflow-y-auto etkisiz
            kalıyor ve mobilde alttaki yorumlara kaydırarak ulaşılamıyordu (kullanıcı bildirimi,
            2026-09-03). */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

type AnswerStatus = 'correct' | 'incorrect' | 'revealed';
type TypeFilter = 'all' | QuizQuestion['type'];

const SCOREABLE_TYPES = new Set<QuizQuestion['type']>(['multiple_choice', 'blank', 'matching']);
const INITIAL_VISIBLE = 10;
const FONT_SCALE_KEY = 'soru-bankasi-font-scale';
const MIN_SCALE = 1;
const MAX_SCALE = 2.2;
const SCALE_STEP = 0.2;

// Yazı boyutu tercihi localStorage'da (cihaza özel); sunucuda ve ilk hydration'da 1.
const SCALE_EVENT = 'soru-bankasi:font-scale';
function readScale(): number {
  try {
    const saved = Number(localStorage.getItem(FONT_SCALE_KEY));
    return saved >= MIN_SCALE && saved <= MAX_SCALE ? saved : MIN_SCALE;
  } catch {
    return MIN_SCALE;
  }
}
function subscribeScale(onChange: () => void) {
  window.addEventListener(SCALE_EVENT, onChange);
  return () => window.removeEventListener(SCALE_EVENT, onChange);
}
function setScale(update: (v: number) => number) {
  try {
    localStorage.setItem(FONT_SCALE_KEY, String(update(readScale())));
  } catch {
    // depolama kapalı (gizli sekme vb.) — tercih kaydedilmez
  }
  window.dispatchEvent(new Event(SCALE_EVENT));
}

function relativeDay(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'bugün';
  if (days === 1) return 'yarın';
  return `${days} gün sonra`;
}

// Öğrencinin bu soruyla geçmişi (useQuestionBankViewer → user_question_stats).
function QuestionStatStrip({ stat }: { stat: QuestionStat }) {
  const review = stat.is_mastered ? null : relativeDay(stat.next_review_at);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black sm:text-xs">
      <span className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-1 text-indigo-600 dark:text-indigo-300">
        <RotateCcw className="h-3 w-3" /> {stat.total_attempts} kez çözdün
      </span>
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> {stat.correct_attempts} doğru
      </span>
      <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-600 dark:text-rose-400">
        <XCircle className="h-3 w-3" /> {stat.wrong_attempts} yanlış
      </span>
      {stat.last_answer_correct != null && (
        <span className="rounded-full border border-default px-2.5 py-1 text-muted-foreground">
          Son cevabın: <span className={stat.last_answer_correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{stat.last_answer_correct ? 'doğru' : 'yanlış'}</span>
        </span>
      )}
      {stat.is_mastered ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-300">
          <Award className="h-3 w-3" /> Öğrendin
        </span>
      ) : review ? (
        <span className="rounded-full border border-default px-2.5 py-1 text-muted-foreground">Tekrar: {review}</span>
      ) : null}
    </div>
  );
}

export default function QuestionBankBoard({
  questions: initialQuestions,
  basePath,
  gradeId,
  lessonId,
  unitId,
  commentCounts,
}: {
  questions: QuizQuestion[];
  basePath: string;
  gradeId: number;
  lessonId: number;
  unitId: number;
  commentCounts: Record<number, number>;
}) {
  const isAdmin = useIsAdmin();
  const [questions, setQuestions] = useState(initialQuestions);
  const viewer = useQuestionBankViewer(initialQuestions.map((q) => q.id));
  const studentMode = viewer.status === 'student';
  const shownQuestions = studentMode ? questions.filter((q) => viewer.stats.has(q.id)) : questions;
  const shownRef = useRef(shownQuestions);
  useEffect(() => {
    shownRef.current = shownQuestions;
  });
  // Öğrenci paylaşım linkiyle (?soru=ID) henüz çözmediği bir soruya geldiyse.
  const [lockedSharedQuestion, setLockedSharedQuestion] = useState(false);
  const [answers, setAnswers] = useState<Record<number, AnswerStatus>>({});
  const scale = useSyncExternalStore(subscribeScale, readScale, () => MIN_SCALE);
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  // Yorumlar modalde; UnitDiscussion yalnız modal açılınca monte edilir (soru başına sorgu olmasın).
  const [commentsForId, setCommentsForId] = useState<number | null>(null);
  // Profildeki "Yorumlarım" linkleri vurgulanacak kaydı da taşır (ör. "c88" yorum, "a56" AI cevabı).
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ questionId: number; target?: string }>).detail;
      if (detail?.questionId == null) return;
      setCommentsForId(detail.questionId);
      setHighlightTarget(detail.target ?? null);
    };
    window.addEventListener('soru-bankasi:open-comments', handler);
    return () => window.removeEventListener('soru-bankasi:open-comments', handler);
  }, []);

  // ?soru=ID paylaşım linki (bkz. QuestionBankHighlight): listeyi aç, filtreyi kaldır, soruya kaydır.
  useEffect(() => {
    const handler = (e: Event) => {
      const questionId = (e as CustomEvent<{ questionId: number }>).detail?.questionId;
      if (questionId == null) return;
      const found = shownRef.current.some((q) => q.id === questionId);
      setLockedSharedQuestion(!found);
      if (!found) return;
      setFilter('all');
      setExpanded(true);
      setFocusedId(questionId);
    };
    window.addEventListener(FOCUS_QUESTION_EVENT, handler);
    return () => window.removeEventListener(FOCUS_QUESTION_EVENT, handler);
  }, []);

  // Kaydırma, soru görünür olduktan SONRA. Sayfa ilk yüklenirken üstteki istemci bileşenleri
  // (test kartı vb.) yüksekliği değiştirip yumuşak kaydırmayı yarıda kesiyor — anında kaydır,
  // sayfa oturunca hedef hâlâ yerinde değilse bir kez daha düzelt.
  useEffect(() => {
    if (focusedId == null) return;
    const scrollToTarget = () => {
      const el = document.getElementById(`soru-${focusedId}`);
      if (!el) return;
      const offset = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant' });
    };
    scrollToTarget();
    const timer = window.setTimeout(scrollToTarget, 600);
    return () => window.clearTimeout(timer);
  }, [focusedId]);


  const typeCounts = useMemo(() => {
    const counts = new Map<QuizQuestion['type'], number>();
    for (const q of shownQuestions) counts.set(q.type, (counts.get(q.type) ?? 0) + 1);
    return [...counts.entries()];
  }, [shownQuestions]);

  const matching = filter === 'all' ? shownQuestions : shownQuestions.filter((q) => q.type === filter);
  const limit = expanded || filter !== 'all' ? matching.length : INITIAL_VISIBLE;
  const visibleIds = new Set(matching.slice(0, limit).map((q) => q.id));
  const hiddenCount = matching.length - visibleIds.size;

  const scoreableIds = useMemo(() => new Set(questions.filter((q) => SCOREABLE_TYPES.has(q.type)).map((q) => q.id)), [questions]);
  const correctCount = Object.entries(answers).filter(([id, st]) => st === 'correct' && scoreableIds.has(Number(id))).length;
  const incorrectCount = Object.entries(answers).filter(([id, st]) => st === 'incorrect' && scoreableIds.has(Number(id))).length;
  const studentTotals = studentMode
    ? [...viewer.stats.values()].reduce(
        (acc, st) => ({ correct: acc.correct + st.correct_attempts, wrong: acc.wrong + st.wrong_attempts, mastered: acc.mastered + (st.is_mastered ? 1 : 0) }),
        { correct: 0, wrong: 0, mastered: 0 }
      )
    : null;

  const handleAnswered = useCallback((questionId: number, status: AnswerStatus) => {
    setAnswers((prev) => (questionId in prev ? prev : { ...prev, [questionId]: status }));
  }, []);

  const handleDeleted = useCallback((questionId: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }, []);

  const chipCls = (active: boolean) =>
    `inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors ${
      active ? 'border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'border-default bg-background text-muted-foreground hover:text-default'
    }`;

  return (
    <>
      {lockedSharedQuestion && (
        <p className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
          Paylaşılan soruyu henüz çözmedin. Testi başlatınca karşına çıkacak; çözdükten sonra burada cevabı ve istatistiğinle görünür.
        </p>
      )}

      {studentMode && shownQuestions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-default bg-background p-6 text-center">
          <p className="font-semibold text-default">Bu konudan henüz soru çözmedin</p>
          <p className="mt-1 text-sm text-muted-foreground">Testi başlat. Çözdüğün her soru burada cevabı, kaç kez çözdüğün ve doğru/yanlış sayınla görünecek.</p>
        </div>
      )}

      {shownQuestions.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {studentMode && studentTotals ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                <span className="font-semibold text-default">{shownQuestions.length}/{questions.length} soruyu çözdün</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {studentTotals.correct}</span>
                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400"><XCircle className="h-4 w-4" aria-hidden="true" /> {studentTotals.wrong}</span>
                {studentTotals.mastered > 0 && <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><Award className="h-4 w-4" aria-hidden="true" /> {studentTotals.mastered} öğrenildi</span>}
              </p>
            ) : correctCount + incorrectCount > 0 ? (
              <p className="flex items-center gap-3 text-muted-foreground" aria-live="polite">
                <span>Bu sayfada:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {correctCount} doğru</span>
                <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400"><XCircle className="h-4 w-4" aria-hidden="true" /> {incorrectCount} yanlış</span>
              </p>
            ) : (
              <p className="text-muted-foreground">Bir şık seç, cevabın anında kontrol edilsin.</p>
            )}
            <div className="flex items-center gap-0.5 rounded-lg border border-default bg-background" role="group" aria-label="Yazı boyutu">
              <button type="button" onClick={() => setScale((v) => Math.max(MIN_SCALE, Math.round((v - SCALE_STEP) * 100) / 100))} disabled={scale <= MIN_SCALE} aria-label="Yazıyı küçült" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-default disabled:opacity-40">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-xs font-semibold text-muted-foreground">%{Math.round(scale * 100)}</span>
              <button type="button" onClick={() => setScale((v) => Math.min(MAX_SCALE, Math.round((v + SCALE_STEP) * 100) / 100))} disabled={scale >= MAX_SCALE} aria-label="Yazıyı büyüt" title="Yazıyı büyüt (akıllı tahta için)" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-default disabled:opacity-40">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          {typeCounts.length > 1 && (
            <div role="group" aria-label="Soru türü" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')} className={chipCls(filter === 'all')}>
                Tümü <span className="opacity-60">{shownQuestions.length}</span>
              </button>
              {typeCounts.map(([type, count]) => (
                <button key={type} type="button" aria-pressed={filter === type} onClick={() => setFilter(type)} className={chipCls(filter === type)}>
                  {TYPE_LABELS[type]} <span className="opacity-60">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {shownQuestions.map((q, i) => {
          const stat = studentMode ? viewer.stats.get(q.id) : undefined;
          return (
            <li
              key={q.id}
              id={`soru-${q.id}`}
              // Gizleme inline display:none + ayrı işaretleyici class — noscript override'ı SADECE
              // soru kartlarını hedeflesin diye (bkz. [konu]/page.tsx).
              className={`question-bank-item scroll-mt-24 rounded-[20px] border bg-background p-4 transition-shadow sm:p-5 ${
                focusedId === q.id ? 'border-indigo-400 ring-2 ring-indigo-500/30' : 'border-default'
              }`}
              style={{ display: visibleIds.has(q.id) ? undefined : 'none' }}
            >
              <QuestionCardHeader question={q} number={i + 1} isAdmin={isAdmin} onDeleted={handleDeleted} />
              {stat && <QuestionStatStrip stat={stat} />}
              {studentMode ? (
                <QuestionAnswerKeyItem question={q} fontScale={scale} />
              ) : (
                <QuestionAnswerKeyItem question={q} fontScale={scale} interactive onAnswered={handleAnswered} />
              )}
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-default pt-3">
                <button
                  type="button"
                  onClick={() => setCommentsForId(q.id)}
                  className="flex min-h-9 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Yorumlar{commentCounts[q.id] ? ` (${commentCounts[q.id]})` : ''}
                </button>
                <ShareQuestionButton question={q} basePath={basePath} />
              </div>
            </li>
          );
        })}
      </ol>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-default bg-background font-semibold text-default transition-colors hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          Kalan {hiddenCount} soruyu göster <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {commentsForId != null && (() => {
        const commentQuestionIndex = questions.findIndex((q) => q.id === commentsForId);
        const activeQuestion = commentQuestionIndex === -1 ? null : questions[commentQuestionIndex];
        if (!activeQuestion) return null;
        return (
          <CommentsModal index={commentQuestionIndex} onClose={() => setCommentsForId(null)}>
            <UnitDiscussion
              gradeId={gradeId}
              lessonId={lessonId}
              unitId={unitId}
              quizQuestionId={activeQuestion.id}
              questionContext={formatQuestionContext(activeQuestion)}
              defaultExpanded
              hideToggle
              highlightTarget={highlightTarget}
              isAdmin={isAdmin}
            />
          </CommentsModal>
        );
      })()}
    </>
  );
}
