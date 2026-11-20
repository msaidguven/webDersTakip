'use client';

import { useMemo, useRef, useState } from 'react';
import type { V2OrderStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function OrderGame({ step, onReact, onMiss, onComplete }: { step: V2OrderStep } & GameCallbacks) {
  const pool = useMemo(() => {
    const arr = step.items.map((text, idx) => ({ text, idx }));
    let seed = step.items.length * 7919 + 131;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 48271) % 2147483647;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [step.items]);

  const [placed, setPlaced] = useState<number[]>([]);
  const [badIdx, setBadIdx] = useState<number | null>(null);
  const missedOnce = useRef(false);

  const allDone = placed.length === step.items.length;

  const handlePick = (idx: number) => {
    const expected = placed.length;
    if (idx === expected) {
      const next = [...placed, idx];
      setPlaced(next);
      if (next.length === step.items.length) {
        onReact('happy', `🎉 ${step.feedback ?? 'Süper! Sıralamayı kusursuz tamamladın.'}`, 'ok', 'ok');
      } else {
        onReact('happy', `Doğru! Şimdi ${next.length + 1}. sıraya hangisi gelmeli?`, 'ok', 'ok');
      }
      return;
    }
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setBadIdx(idx);
    onReact('oops', `Şimdi ${expected + 1}. sıraya hangisi gelmeli? Baştan sona doğru düşün!`, 'oops', 'retry');
    window.setTimeout(() => setBadIdx(null), 400);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        {step.items.map((_, slotIdx) => {
          const placedIdx = placed[slotIdx];
          const filled = placedIdx !== undefined;
          return (
            <div
              key={slotIdx}
              className={`flex min-h-[44px] items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-sm font-extrabold transition ${
                filled
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                  : 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-black ${
                  filled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {slotIdx + 1}
              </span>
              <span>{filled ? step.items[placedIdx] : (step.slotPlaceholder ?? 'Sıradakini seç 👇')}</span>
            </div>
          );
        })}
      </div>

      {allDone ? (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Devam →
        </button>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {pool.map((item) => {
            const used = placed.includes(item.idx);
            const isBad = badIdx === item.idx;
            return (
              <button
                key={item.idx}
                type="button"
                disabled={used}
                onClick={() => handlePick(item.idx)}
                className={`${s.tileBtn} !min-h-[44px] !px-3.5 !py-2 !text-sm ${
                  used ? 'opacity-25' : isBad ? s.tileBad : ''
                }`}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
