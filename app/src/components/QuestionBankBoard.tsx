'use client';

// /soru-bankasi sayfasındaki soru listesini + üstteki "X/Y cevaplandı, Z doğru" sayacını +
// büyüteç (+/-) kontrolünü + sağdaki "optik" soru haritasını render eder. Sayaç sadece
// puanlanabilir sorular (çoktan seçmeli/boşluk doldurma/eşleştirme) üzerinden hesaplanır —
// açık uçlu sorularda otomatik doğru/yanlış sinyali yok, sadece "cevap gösterildi" durumu var
// (bkz. QuestionAnswerKeyItem'daki onAnswered 'revealed' durumu). State tamamen bu oturuma
// özel client-side state'tir, backend'e yazılmaz.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import { QuestionAnswerKeyItem } from '@/app/src/components/QuizClient';
import QuestionCardHeader from '@/app/src/components/QuestionCardHeader';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';

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

export default function QuestionBankBoard({ questions: initialQuestions, basePath }: { questions: QuizQuestion[]; basePath: string }) {
  const isAdmin = useIsAdmin();
  const [questions, setQuestions] = useState(initialQuestions);
  const [answers, setAnswers] = useState<Record<number, AnswerStatus>>({});
  const [scale, setScale] = useState(MIN_SCALE);

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
          </div>
        ))}
      </div>

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
