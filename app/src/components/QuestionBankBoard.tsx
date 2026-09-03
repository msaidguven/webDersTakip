'use client';

// /soru-bankasi sayfasındaki soru listesini + "X/Y cevaplandı, Z doğru" sayacını render eder.
// Sayaç sadece çoktan seçmeli/boşluk doldurma sorularını sayar (Y = bu tipteki soru sayısı) —
// eşleştirme/açık uçlu sorularda "doğru/yanlış" sinyali veren tek bir tıklama olmadığı için
// (bkz. QuestionAnswerKeyItem'daki "Cevabı Göster" butonu) bunlar sayaca dahil edilmiyor.
// State tamamen bu oturuma özel client-side state'tir, backend'e yazılmaz.
import { useCallback, useMemo, useState } from 'react';
import type { QuizQuestion } from '@/app/src/lib/quizQuestions';
import { TYPE_LABELS, QuestionAnswerKeyItem } from '@/app/src/components/QuizClient';

const SCOREABLE_TYPES = new Set<QuizQuestion['type']>(['multiple_choice', 'blank']);

export default function QuestionBankBoard({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, boolean>>({});

  const scoreableIds = useMemo(() => questions.filter((q) => SCOREABLE_TYPES.has(q.type)).map((q) => q.id), [questions]);
  const answeredCount = scoreableIds.filter((id) => id in answers).length;
  const correctCount = scoreableIds.filter((id) => answers[id]).length;

  const handleAnswered = useCallback((questionId: number, correct: boolean) => {
    setAnswers((prev) => (questionId in prev ? prev : { ...prev, [questionId]: correct }));
  }, []);

  return (
    <>
      {scoreableIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-default bg-surface-elevated px-3.5 py-2.5 text-xs font-black sm:mb-6 sm:px-4">
          <span className="text-default">
            {answeredCount}/{scoreableIds.length} soru cevaplandı
          </span>
          <span className="text-emerald-500">{correctCount} doğru</span>
        </div>
      )}
      <div className="space-y-3 sm:space-y-4">
        {questions.map((q, i) => (
          <div key={q.id} id={`soru-${q.id}`} className="scroll-mt-24 rounded-2xl border border-default bg-surface-elevated p-3.5 shadow-sm sm:p-6">
            <span className="mb-2 inline-block rounded-full bg-surface px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-muted-foreground sm:mb-3">
              {TYPE_LABELS[q.type]}
            </span>
            <QuestionAnswerKeyItem question={q} index={i} interactive onAnswered={handleAnswered} />
          </div>
        ))}
      </div>
    </>
  );
}
