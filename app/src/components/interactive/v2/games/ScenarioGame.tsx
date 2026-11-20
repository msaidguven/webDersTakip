'use client';

// Yeni Mikro-Oyun 2: Senaryo Kararı — Günlük yaşam veya laboratuvar durumuna en doğru tepkiyi seç.
import { useRef, useState } from 'react';
import type { V2ScenarioStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function ScenarioGame({ step, onReact, onMiss, onComplete }: { step: V2ScenarioStep } & GameCallbacks) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrongPicks, setWrongPicks] = useState<Set<number>>(() => new Set());
  const missedOnce = useRef(false);

  const round = step.rounds[roundIdx];

  const handlePick = (optIdx: number) => {
    if (solved) return;
    const opt = round.options[optIdx];
    if (optIdx === round.answer) {
      setSolved(true);
      onReact('happy', `🎯 ${opt.feedback}`, 'ok', 'ok');
      return;
    }
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setWrongPicks((prev) => new Set(prev).add(optIdx));
    onReact('oops', opt.feedback, 'oops', 'retry');
  };

  const nextRound = () => {
    if (roundIdx + 1 < step.rounds.length) {
      setRoundIdx((r) => r + 1);
      setSolved(false);
      setWrongPicks(new Set());
      onReact('normal', step.say, 'normal', 'tap');
    } else {
      onComplete();
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="text-center text-xs font-extrabold text-slate-500">
        Senaryo {roundIdx + 1} / {step.rounds.length}
      </div>

      <div className="flex flex-col items-center gap-2 rounded-3xl p-4 text-center" style={{ background: 'var(--tint)' }}>
        <div className="text-5xl leading-none" aria-hidden="true">
          {round.emoji}
        </div>
        <p className="text-[15.5px] font-extrabold leading-snug text-slate-900">{round.situation}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {round.options.map((opt, idx) => {
          const isOk = solved && idx === round.answer;
          const isBad = wrongPicks.has(idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={solved || isBad}
              onClick={() => handlePick(idx)}
              className={`${s.tileBtn} ${isOk ? s.tileOk : isBad ? `${s.tileBad} opacity-60` : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {solved && (
        <button type="button" onClick={nextRound} className={s.goBtn}>
          {roundIdx + 1 < step.rounds.length ? 'Sıradaki Senaryo →' : 'Devam →'}
        </button>
      )}
    </div>
  );
}
