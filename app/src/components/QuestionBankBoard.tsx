'use client';

// /soru-bankasi sayfasındaki soru listesini + üstteki "X/Y cevaplandı, Z doğru" sayacını +
// büyüteç (+/-) kontrolünü + sağdaki "optik" soru haritasını render eder. Sayaç sadece
// puanlanabilir sorular (çoktan seçmeli/boşluk doldurma/eşleştirme) üzerinden hesaplanır —
// açık uçlu sorularda otomatik doğru/yanlış sinyali yok, sadece "cevap gösterildi" durumu var
// (bkz. QuestionAnswerKeyItem'daki onAnswered 'revealed' durumu). State tamamen bu oturuma
// özel client-side state'tir, backend'e yazılmaz.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, MessageCircle, Plus, X } from 'lucide-react';
import { formatQuestionContext, type QuizQuestion } from '@/app/src/lib/quizQuestions';
import { QuestionAnswerKeyItem } from '@/app/src/components/QuizClient';
import QuestionCardHeader from '@/app/src/components/QuestionCardHeader';
import UnitDiscussion from '@/app/src/components/UnitDiscussion';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';

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

const SCOREABLE_TYPES = new Set<QuizQuestion['type']>(['multiple_choice', 'blank', 'matching']);
const FONT_SCALE_KEY = 'soru-bankasi-font-scale';
const MIN_SCALE = 1;
const MAX_SCALE = 2.2;
const SCALE_STEP = 0.2;

function dotColorClass(status: AnswerStatus | undefined): string {
  if (status === 'correct') return 'bg-emerald-500 text-white';
  if (status === 'incorrect') return 'bg-rose-500 text-white';
  if (status === 'revealed') return 'bg-indigo-500 text-white';
  return 'border border-default bg-surface text-muted-foreground';
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
  const [answers, setAnswers] = useState<Record<number, AnswerStatus>>({});
  const [scale, setScale] = useState(MIN_SCALE);
  // Yorumlar bir modalde açılıyor, tek seferde en fazla bir tanesi — UnitDiscussion
  // (kendi auth/veri sorgularını mount olur olmaz çalıştırıyor) sadece modal açılınca
  // monte ediliyor, yoksa bir konudaki onlarca soru için aynı anda onlarca sorgu ateşlenirdi.
  const [commentsForId, setCommentsForId] = useState<number | null>(null);
  // Profildeki "Yorumlarım"dan gelen linkler hangi kaydın vurgulanacağını da taşır
  // (ör. "c88" bir yorum, "a56" bir AI cevabı) — UnitDiscussion'a geçiliyor, o da
  // feed yüklenince o kayda kaydırıp kısa süreliğine vurguluyor.
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);

  // Profildeki "Yorumlarım"dan ?soru=ID&yorum=... ile gelen deep-link'ler (bkz.
  // QuestionBankHighlight) ilgili sorunun yorum modalini otomatik açsın diye —
  // bkz. o component'teki event notu. Düz ?soru=ID linkleri (target yok) bu event'i
  // hiç dispatch etmiyor, modal açılmıyor.
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

  useEffect(() => {
    const saved = Number(localStorage.getItem(FONT_SCALE_KEY));
    if (saved >= MIN_SCALE && saved <= MAX_SCALE) setScale(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem(FONT_SCALE_KEY, String(scale));
  }, [scale]);

  const scoreableIds = useMemo(() => questions.filter((q) => SCOREABLE_TYPES.has(q.type)).map((q) => q.id), [questions]);
  const answeredCount = scoreableIds.filter((id) => id in answers).length;
  const correctCount = scoreableIds.filter((id) => answers[id] === 'correct').length;

  const handleAnswered = useCallback((questionId: number, status: AnswerStatus) => {
    setAnswers((prev) => (questionId in prev ? prev : { ...prev, [questionId]: status }));
  }, []);

  const handleDeleted = useCallback((questionId: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  }, []);

  const scrollToQuestion = (id: number) => {
    document.getElementById(`soru-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-default bg-surface-elevated px-3.5 py-2.5 sm:mb-6 sm:px-4">
        <div className="text-xs font-black">
          <span className="text-default">
            {answeredCount}/{scoreableIds.length} soru cevaplandı
          </span>
          <span className="ml-2.5 text-emerald-500">{correctCount} doğru</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, Math.round((s - SCALE_STEP) * 100) / 100))}
            disabled={scale <= MIN_SCALE}
            aria-label="Yazıyı küçült"
            title="Yazıyı küçült"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-default text-muted-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-9 text-center text-[10px] font-black text-muted-foreground">%{Math.round(scale * 100)}</span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, Math.round((s + SCALE_STEP) * 100) / 100))}
            disabled={scale >= MAX_SCALE}
            aria-label="Yazıyı büyüt"
            title="Yazıyı büyüt (akıllı tahta için)"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-default text-muted-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} id={`soru-${q.id}`} className="scroll-mt-24 rounded-2xl border border-default bg-surface-elevated p-3.5 shadow-sm sm:p-6">
            <QuestionCardHeader question={q} isAdmin={isAdmin} basePath={basePath} onDeleted={handleDeleted} />
            <div style={{ zoom: scale }}>
              <QuestionAnswerKeyItem question={q} index={i} interactive onAnswered={handleAnswered} />
            </div>

            <button
              type="button"
              onClick={() => setCommentsForId(q.id)}
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-indigo-500"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Yorumlar{commentCounts[q.id] ? ` (${commentCounts[q.id]})` : ''}
            </button>
          </div>
        ))}
      </div>

      {commentsForId != null && (() => {
        const activeIndex = questions.findIndex((q) => q.id === commentsForId);
        const activeQuestion = activeIndex === -1 ? null : questions[activeIndex];
        if (!activeQuestion) return null;
        return (
          <CommentsModal index={activeIndex} onClose={() => setCommentsForId(null)}>
            <UnitDiscussion
              gradeId={gradeId}
              lessonId={lessonId}
              unitId={unitId}
              quizQuestionId={activeQuestion.id}
              questionContext={formatQuestionContext(activeQuestion)}
              defaultExpanded
              hideToggle
              highlightTarget={highlightTarget}
            />
          </CommentsModal>
        );
      })()}

      {questions.length > 1 && (
        <nav
          aria-label="Sorular arası hızlı geçiş"
          className="fixed right-3 top-1/2 z-20 hidden max-h-[75vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-default bg-surface-elevated/95 p-2.5 shadow-lg backdrop-blur lg:block"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => scrollToQuestion(q.id)}
                title={`Soru ${i + 1}`}
                aria-label={`Soru ${i + 1}'e git`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black transition-transform hover:scale-110 ${dotColorClass(answers[q.id])}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
