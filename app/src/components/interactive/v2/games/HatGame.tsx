'use client';

import { useMemo, useRef, useState } from 'react';
import type { V2HatStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function HatGame({ step, onReact, onMiss, onComplete }: { step: V2HatStep } & GameCallbacks) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrongPicks, setWrongPicks] = useState<Set<number>>(() => new Set());
  const missedOnce = useRef(false);

  const round = step.rounds[roundIdx];
  const order = useMemo(() => {
    const arr = round.options.map((_, i) => i);
    // Basit sabit karıştırma (tur bazlı)
    return arr.sort((a, b) => ((a * 7 + roundIdx * 3) % 5) - ((b * 7 + roundIdx * 3) % 5));
  }, [round.options, roundIdx]);

  const handlePick = (optIdx: number) => {
    if (solved) return;
    if (optIdx === round.answer) {
      setSolved(true);
      onReact('happy', `🎉 ${round.feedback}`, 'ok', 'ok');
      return;
    }
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setWrongPicks((prev) => new Set(prev).add(optIdx));
    onReact('oops', 'Bu ortama başka bir rozet daha uygun. Bir daha dene!', 'oops', 'retry');
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

  const chosen = solved ? round.options[round.answer] : null;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="text-center text-xs font-extrabold text-slate-500">
        {roundIdx + 1} / {step.rounds.length}
      </div>

      <div className="flex flex-col items-center gap-2 rounded-3xl p-4 text-center" style={{ background: 'var(--tint)' }}>
        <div className="text-5xl leading-none" aria-hidden="true">
          {round.scene}
        </div>
        <div className="text-base font-extrabold text-slate-900">{round.place}</div>
        <div
          className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border-2 px-4 py-1 text-sm font-extrabold ${
            chosen
              ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
              : 'border-dashed border-slate-400 bg-white/80 text-slate-500'
          }`}
        >
          {chosen ? `✓ ${chosen.emoji} ${chosen.label}` : (step.slotPrompt ?? 'Rozet seç 👇')}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {order.map((optIdx) => {
          const opt = round.options[optIdx];
          const isOk = solved && optIdx === round.answer;
          const isBad = wrongPicks.has(optIdx);
          return (
            <button
              key={optIdx}
              type="button"
              disabled={solved || isBad}
              onClick={() => handlePick(optIdx)}
              className={`${s.tileBtn} flex flex-col items-center justify-center gap-1 !px-2 !py-3 text-center !text-xs ${
                isOk ? s.tileOk : isBad ? `${s.tileBad} opacity-55` : ''
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {opt.emoji}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {solved && (
        <button type="button" onClick={nextRound} className={s.goBtn}>
          {roundIdx + 1 < step.rounds.length ? 'Sıradaki Tur →' : 'Devam →'}
        </button>
      )}
    </div>
  );
}
