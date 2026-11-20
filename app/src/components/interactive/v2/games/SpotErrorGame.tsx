'use client';

// Yeni Mikro-Oyun 1: Hata Avcısı — Cümledeki bilimsel olarak yanlış tek ifadeye dokun, doğru hâline dönüşsün.
import { useRef, useState } from 'react';
import type { V2SpotErrorStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function SpotErrorGame({ step, onReact, onMiss, onComplete }: { step: V2SpotErrorStep } & GameCallbacks) {
  const [solved, setSolved] = useState(false);
  const [badIdx, setBadIdx] = useState<number | null>(null);
  const missedOnce = useRef(false);

  const handleTap = (idx: number) => {
    if (solved) return;
    if (idx === step.errorIndex) {
      setSolved(true);
      onReact('happy', `🔎 ${step.feedback}`, 'ok', 'ok');
      return;
    }
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setBadIdx(idx);
    onReact('oops', `Bu kelime doğru görünüyor. İpucu: ${step.hint}`, 'oops', 'retry');
    window.setTimeout(() => setBadIdx(null), 420);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className={s.tokenBox} role="group" aria-label="Yanlış kelimeyi seç">
        {step.tokens.map((tok, i) => {
          const isErrorSlot = i === step.errorIndex;
          const isBad = badIdx === i;
          return (
            <button
              key={i}
              type="button"
              disabled={solved}
              onClick={() => handleTap(i)}
              className={`${s.tokenChip} ${solved && isErrorSlot ? s.tokenFixed : isBad ? s.tileBad : ''}`}
            >
              {solved && isErrorSlot ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-xs line-through opacity-55">{tok}</span>
                  <span>✓ {step.correction}</span>
                </span>
              ) : (
                tok
              )}
            </button>
          );
        })}
      </div>

      {!solved && (
        <p className="text-center text-xs font-bold text-slate-500">
          👆 Cümledeki yanlış kelimeye dokun!
        </p>
      )}

      {solved && (
        <button type="button" onClick={onComplete} className={s.goBtn}>
          Devam →
        </button>
      )}
    </div>
  );
}
