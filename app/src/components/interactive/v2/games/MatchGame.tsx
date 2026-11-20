'use client';

import { useMemo, useRef, useState } from 'react';
import type { V2MatchStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

function shuffleIndices(n: number, salt: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  let seed = (n * 9301 + salt * 49297 + 233280) % 233280;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = seed % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function MatchGame({ step, onReact, onMiss, onComplete }: { step: V2MatchStep } & GameCallbacks) {
  const leftOrder = useMemo(() => shuffleIndices(step.pairs.length, 17), [step.pairs.length]);
  const rightOrder = useMemo(() => shuffleIndices(step.pairs.length, 53), [step.pairs.length]);

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [badRight, setBadRight] = useState<number | null>(null);
  const missedOnce = useRef(false);

  const allDone = matched.size === step.pairs.length;

  const pickLeft = (idx: number) => {
    setSelectedLeft(idx);
    onReact('normal', step.say, 'normal', 'tap');
  };

  const pickRight = (idx: number) => {
    if (selectedLeft === null) {
      onReact('oops', 'Önce sol sütundan bir kart seç!', 'oops', 'retry');
      return;
    }
    if (idx === selectedLeft) {
      const next = new Set(matched);
      next.add(idx);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === step.pairs.length) {
        onReact('happy', `🎉 ${step.feedback ?? 'Harika! Tüm eşleştirmeleri tamamladın.'}`, 'ok', 'ok');
      } else {
        onReact('happy', 'Süper eşleşme! Sıradakini bul 👇', 'ok', 'ok');
      }
      return;
    }
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setBadRight(idx);
    onReact('oops', 'Bu ikisi eşleşmiyor, başka bir sağ kart dene!', 'oops', 'retry');
    window.setTimeout(() => setBadRight(null), 400);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-2.5">
          {leftOrder.map((idx) => {
            const done = matched.has(idx);
            const sel = selectedLeft === idx;
            return (
              <button
                key={`l-${idx}`}
                type="button"
                disabled={done}
                onClick={() => pickLeft(idx)}
                className={`${s.tileBtn} text-center ${done ? `${s.tileOk} opacity-85` : sel ? s.tileSel : ''}`}
              >
                {step.pairs[idx][0]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2.5">
          {rightOrder.map((idx) => {
            const done = matched.has(idx);
            const bad = badRight === idx;
            return (
              <button
                key={`r-${idx}`}
                type="button"
                disabled={done}
                onClick={() => pickRight(idx)}
                className={`${s.tileBtn} text-center ${done ? `${s.tileOk} opacity-85` : bad ? s.tileBad : ''}`}
              >
                {step.pairs[idx][1]}
              </button>
            );
          })}
        </div>
      </div>

      {allDone && (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Devam →
        </button>
      )}
    </div>
  );
}
