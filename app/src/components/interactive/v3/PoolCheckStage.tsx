'use client';

// Oyun Dünyası İçi Bölüm Kontrol Sorusu (Anında 1 Tıkla Kontrol — "Kontrol Et" düğmesi yok).
import { useState } from 'react';
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import MathText from '@/app/src/components/MathText';
import { QuestionSvg } from '@/app/src/components/QuizClient';
import { GUIDE } from '@/app/src/lib/interactiveLesson/guide';
import type { HydratedV3Question } from '@/app/src/lib/interactiveLesson/typesV3';
import RobotGuide from '../RobotGuide';
import type { MiniGameFeedback } from './games/MiniGameRegistry';
import { VoiceControls, type VoiceStatus } from './VoiceControls';
import s from './v3.module.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function PoolCheckStage({
  question,
  index,
  total,
  onFeedback,
  onSolved,
  onSpeak,
  canSpeak,
  voiceStatus = 'idle',
  onPauseVoice,
  onResumeVoice,
}: {
  question: HydratedV3Question;
  index: number;
  total: number;
  onFeedback: (fb: MiniGameFeedback) => void;
  onSolved: () => void;
  onSpeak?: (text: string, force?: boolean) => void;
  canSpeak?: (text: string) => boolean;
  voiceStatus?: VoiceStatus;
  onPauseVoice?: () => void;
  onResumeVoice?: () => void;
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
      {/* Üst Atom Soru Kutusu */}
      <div className={s.gameQuestionHeader}>
        <div className="w-12 shrink-0 xl:w-16">
          <RobotGuide mood={solved ? 'celebrate' : wrongIds.size > 0 ? 'oops' : 'think'} />
        </div>
        <div className="min-w-0 flex-1">
          <span
            className="mb-1 block font-extrabold uppercase tracking-wider text-sky-700"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            Kontrol Sorusu {index + 1} / {total}
          </span>
          <div className={s.gameQuestionText}>
            {question.svg_content && question.svg_position === 'above' && (
              <div className="mb-2">
                <QuestionSvg svgContent={question.svg_content} />
              </div>
            )}
            <MathText text={question.question_text} />
            {question.svg_content && question.svg_position !== 'above' && (
              <div className="mt-2">
                <QuestionSvg svgContent={question.svg_content} />
              </div>
            )}
          </div>
        </div>
        {onSpeak && canSpeak?.(question.question_text) && (
          <VoiceControls
            status={voiceStatus}
            onPause={() => onPauseVoice?.()}
            onResume={() => onResumeVoice?.()}
            onReplay={() => onSpeak(question.question_text, true)}
            replayLabel="Tekrar Dinle"
          />
        )}
      </div>

      {/* Seçenek Kartları (2 sütunlu oyun kartları — tıklar tıklamaz anında kontrol) */}
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
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className={s.gameChoiceBadge}>{LETTERS[idx] ?? idx + 1}</span>
                {isCorrect && (
                  <span
                    className="inline-flex items-center gap-1 font-extrabold text-emerald-700"
                    style={{ fontSize: 'var(--fs-sm)' }}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Doğru!
                  </span>
                )}
                {isWrong && (
                  <span
                    className="inline-flex items-center gap-1 font-extrabold text-rose-700"
                    style={{ fontSize: 'var(--fs-sm)' }}
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" /> Tekrar dene
                  </span>
                )}
              </div>
              <div>
                <MathText text={opt.text} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Anında Yeşil "Doğru Bildin!" Geri Bildirim Paneli */}
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
