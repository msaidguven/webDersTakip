'use client';

// Oyun Dünyası İçi Bölüm Kontrol Sorusu (Anında 1 Tıkla Kontrol).
// Ses kontrolleri alt bara taşındığı için soru kartı %100 temiz ve simetriktir.
import { useState } from 'react';
import { CheckCircle2, Lightbulb, Sparkles, XCircle } from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { QuestionSvg } from '@/app/src/components/QuizClient';
import { GUIDE } from '@/app/src/lib/interactiveLesson/guide';
import type { HydratedV3Question } from '@/app/src/lib/interactiveLesson/typesV3';
import RobotGuide from '../RobotGuide';
import type { MiniGameFeedback } from './games/MiniGameRegistry';
import s from './v3.module.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function PoolCheckStage({
  question,
  index,
  total,
  onFeedback,
  onSolved,
}: {
  question: HydratedV3Question;
  index: number;
  total: number;
  onFeedback: (fb: MiniGameFeedback) => void;
  onSolved: () => void;
}) {
  const options = question.type === 'multiple_choice' ? question.choices : question.options;
  const [wrongIds, setWrongIds] = useState<Set<number>>(() => new Set());
  const [solved, setSolved] = useState(false);

  const handleSelect = (optId: number, isCorrect: boolean) => {
    if (solved || wrongIds.has(optId)) return;

    if (isCorrect) {
      setSolved(true);
      onSolved();
      onFeedback({
        mood: 'happy',
        text: question.solution_text || GUIDE.v3PoolOkFallback,
        tone: 'ok',
        sfx: 'ok',
      });
      return;
    }

    setWrongIds((prev) => new Set(prev).add(optId));
    onFeedback({
      mood: 'oops',
      text: GUIDE.v3PoolWrong,
      tone: 'oops',
      sfx: 'retry',
    });
  };

  return (
    <div className={s.gameQuestionWrap}>
      <div className={s.mentorCard}>
        <div className={s.mentorAvatarDock}>
          <RobotGuide mood={solved ? 'celebrate' : wrongIds.size > 0 ? 'oops' : 'think'} />
        </div>
        <div className={s.mentorBody}>
          <div className={s.mentorTopRow}>
            <span className={s.mentorKickerBadge}>
              Kontrol Sorusu {index + 1} / {total}
            </span>
          </div>
          <div className={s.gameQuestionText}>
            {question.svg_content && question.svg_position === 'above' && (
              <div className="mb-2.5">
                <QuestionSvg svgContent={question.svg_content} />
              </div>
            )}
            <MathText text={question.question_text} />
            {question.svg_content && question.svg_position !== 'above' && (
              <div className="mt-2.5">
                <QuestionSvg svgContent={question.svg_content} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={s.gameChoiceGrid}>
        {options.map((opt, idx) => {
          const isCorrect = solved && opt.is_correct;
          const isWrong = wrongIds.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              disabled={solved || isWrong}
              onClick={() => handleSelect(opt.id, opt.is_correct)}
              className={`${s.gameChoiceCard} ${
                isCorrect ? s.gameChoiceOk : isWrong ? s.gameChoiceBad : ''
              }`}
            >
              <span className={s.gameChoiceBadge}>{LETTERS[idx] ?? idx + 1}</span>
              <span className={s.gameChoiceText}>
                <MathText text={opt.text} />
              </span>
              {isCorrect && (
                <span
                  className="ml-auto inline-flex shrink-0 items-center gap-1 font-extrabold text-emerald-700"
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Doğru!
                </span>
              )}
              {isWrong && (
                <span
                  className="ml-auto inline-flex shrink-0 items-center gap-1 font-extrabold text-rose-700"
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" /> Eledin
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!solved && wrongIds.size > 0 && (
        <div className={s.gameRetryPanel}>
          <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>{GUIDE.v3PoolWrong}</span>
        </div>
      )}

      {solved && (
        <div className={s.gameSuccessPanel}>
          <div className="flex items-center justify-center gap-1.5 font-black text-emerald-900">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Doğru bildin!
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
          </div>
          {question.solution_text && (
            <p className="m-0 font-semibold leading-relaxed text-emerald-950">
              {question.solution_text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
