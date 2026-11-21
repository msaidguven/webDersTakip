'use client';

// Süreç / Zaman Hattı Sıralaması: Dikey bağlantılı istasyon rayı üzerinde doğru sırayı kur.
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
        onReact('celebrate', step.feedback ?? 'Süper! Sıralamayı kusursuz tamamladın.', 'ok', 'combo', next.length);
      } else {
        onReact('happy', `Doğru! Şimdi ${next.length + 1}. sıraya hangisi gelmeli?`, 'ok', 'link', next.length);
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
      <div className={s.orderRail}>
        {step.items.map((_, slotIdx) => {
          const placedIdx = placed[slotIdx];
          const filled = placedIdx !== undefined;
          const isNext = slotIdx === placed.length;
          return (
            <div key={slotIdx} className="relative flex items-center gap-2.5">
              {/* Dikey bağlantı çizgisi */}
              {slotIdx < step.items.length - 1 && (
                <span
                  className={`${s.orderConnector} ${filled ? s.orderConnectorFilled : ''}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black transition ${
                  filled
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : isNext
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {filled ? '✓' : slotIdx + 1}
              </span>
              <div
                className={`flex min-h-[42px] flex-1 items-center rounded-2xl border-2 px-3 py-1.5 text-sm font-extrabold transition ${
                  filled
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                    : isNext
                      ? 'border-dashed border-indigo-400 bg-indigo-50/50 text-indigo-700'
                      : 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
                }`}
              >
                {filled ? step.items[placedIdx] : isNext ? (step.slotPlaceholder ?? 'Sıradaki adımı seç') : `${slotIdx + 1}. durak`}
              </div>
            </div>
          );
        })}
      </div>

      {allDone ? (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Rotayı Onayla ve Devam Et →
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
                className={`${s.tileBtn} !min-h-[42px] !px-3.5 !py-2 !text-sm ${
                  used ? 'scale-95 opacity-25' : isBad ? s.tileBad : ''
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
