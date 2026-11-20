'use client';

// Havuz Sorusu (questions tablosundan hydrate.ts ile gelen gerçek çoktan seçmeli / boşluk sorusu).
import { useRef, useState } from 'react';
import MathText from '@/app/src/components/MathText';
import { QuestionSvg } from '@/app/src/components/QuizClient';
import type { HydratedV2PoolQuestionStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function PoolQuestionGame({
  step,
  onReact,
  onMiss,
  onComplete,
}: { step: HydratedV2PoolQuestionStep } & GameCallbacks) {
  const q = step.question;
  const options = q.type === 'multiple_choice' ? q.choices : q.options;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [wrongIds, setWrongIds] = useState<Set<number>>(() => new Set());
  const missedOnce = useRef(false);

  const checkAnswer = () => {
    if (selectedId === null || solved) return;
    const picked = options.find((o) => o.id === selectedId);
    if (!picked) return;

    if (picked.is_correct) {
      setSolved(true);
      onReact(
        'happy',
        `🎉 Harika! ${q.solution_text ? q.solution_text : 'Doğru cevabı buldun!'}`,
        'ok',
        'ok',
      );
      return;
    }

    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setWrongIds((prev) => new Set(prev).add(selectedId));
    setSelectedId(null);
    onReact('oops', 'Bu seçenek değil, soruyu bir kez daha dikkatlice okuyup tekrar dene!', 'oops', 'retry');
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3.5 text-[15.5px] font-bold leading-relaxed text-slate-900">
        {q.svg_content && q.svg_position === 'above' && (
          <div className="mb-3">
            <QuestionSvg svgContent={q.svg_content} />
          </div>
        )}
        <MathText text={q.question_text} />
        {q.svg_content && q.svg_position !== 'above' && (
          <div className="mt-3">
            <QuestionSvg svgContent={q.svg_content} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {options.map((opt, idx) => {
          const isOk = solved && opt.is_correct;
          const isBad = wrongIds.has(opt.id);
          const isSel = !solved && selectedId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={solved || isBad}
              onClick={() => {
                setSelectedId(opt.id);
                onReact('think', step.say ?? 'Cevabını kontrol etmek için düğmeye dokun!', 'normal', 'tap');
              }}
              className={`${s.tileBtn} flex items-start gap-2.5 ${
                isOk ? s.tileOk : isBad ? `${s.tileBad} opacity-55` : isSel ? s.tileSel : ''
              }`}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">
                {LETTERS[idx] ?? idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <MathText text={opt.text} />
              </span>
            </button>
          );
        })}
      </div>

      {solved ? (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Devam →
        </button>
      ) : (
        <button type="button" disabled={selectedId === null} onClick={checkAnswer} className={s.goBtn}>
          Kontrol Et
        </button>
      )}
    </div>
  );
}
