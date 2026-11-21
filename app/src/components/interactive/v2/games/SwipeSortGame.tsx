'use client';

// Dokunsal Kart Ayırma: Canlı yön damgaları + altta bekleyen kart yığını derinliği.
import { useRef, useState } from 'react';
import type { V2SwipeSortStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function SwipeSortGame({ step, onReact, onMiss, onComplete }: { step: V2SwipeSortStep } & GameCallbacks) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [anim, setAnim] = useState<'none' | 'outL' | 'outR' | 'err'>('none');
  const startX = useRef(0);
  const locked = useRef(false);
  const missedOnce = useRef(false);

  const current = step.items[idx];
  const nextCard = step.items[idx + 1];

  const judge = (side: 'L' | 'R') => {
    if (locked.current || done || !current) return;
    if (current.side === side) {
      locked.current = true;
      setDx(0);
      setAnim(side === 'L' ? 'outL' : 'outR');
      onReact('happy', 'Doğru karar!', 'ok', 'ok');
      window.setTimeout(() => {
        setAnim('none');
        locked.current = false;
        if (idx + 1 < step.items.length) {
          setIdx((k) => k + 1);
          onReact('normal', step.say, 'normal');
        } else {
          setDone(true);
          onReact('celebrate', step.feedback ?? 'Süper! Tüm kartları doğru yerleştirdin.', 'ok', 'combo', step.items.length);
        }
      }, 280);
      return;
    }
    if (!missedOnce.current) {
      missedOnce.current = true;
      onMiss();
    }
    setDx(0);
    setAnim('err');
    onReact('oops', `İpucu: ${step.hint}`, 'oops', 'retry');
    window.setTimeout(() => setAnim('none'), 380);
  };

  if (done) {
    return (
      <button type="button" onClick={onComplete} className={s.goBtn}>
        Devam →
      </button>
    );
  }

  const tiltBorder = dx < -30 ? '#15b8d9' : dx > 30 ? '#ff7a29' : undefined;
  const leftOpacity = Math.min(1, Math.max(0, (-dx - 18) / 55));
  const rightOpacity = Math.min(1, Math.max(0, (dx - 18) / 55));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-1.5" aria-label={`${idx + 1} / ${step.items.length}`}>
        {step.items.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              i < idx ? 'w-5 bg-emerald-500' : i === idx ? 'w-7 bg-indigo-600' : 'w-2 bg-slate-300'
            }`}
          />
        ))}
      </div>

      <div className="relative pt-1">
        {/* Altta bekleyen sıradaki kartın yığın derinliği */}
        {nextCard && (
          <div className={s.swipeDeckBack} aria-hidden="true">
            {nextCard.text}
          </div>
        )}

        <div
          className={`${s.swipeCard} relative z-10 ${dragging ? s.swipeDragging : ''} ${
            anim === 'outL' ? s.swipeOutL : anim === 'outR' ? s.swipeOutR : anim === 'err' ? s.tileBad : ''
          }`}
          style={{
            transform: dx ? `translateX(${dx}px) rotate(${dx / 18}deg)` : undefined,
            borderColor: tiltBorder,
          }}
          onPointerDown={(e) => {
            if (locked.current) return;
            startX.current = e.clientX;
            setDx(0);
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            setDx(e.clientX - startX.current);
          }}
          onPointerUp={() => {
            if (!dragging) return;
            setDragging(false);
            if (dx < -60) judge('L');
            else if (dx > 60) judge('R');
            else setDx(0);
          }}
          onPointerCancel={() => {
            setDragging(false);
            setDx(0);
          }}
        >
          {/* Canlı sürükleme yön damgaları */}
          {leftOpacity > 0.05 && (
            <span className={`${s.swipeStamp} ${s.swipeStampL}`} style={{ opacity: leftOpacity }} aria-hidden="true">
              {step.leftLabel}
            </span>
          )}
          {rightOpacity > 0.05 && (
            <span className={`${s.swipeStamp} ${s.swipeStampR}`} style={{ opacity: rightOpacity }} aria-hidden="true">
              {step.rightLabel}
            </span>
          )}
          <span>{current.text}</span>
        </div>
        <p className="mt-2 text-center text-xs font-bold text-slate-400">← Kartı kaydır veya aşağıdaki düğmeye dokun →</p>
      </div>

      <div className={s.twoGrid}>
        <button type="button" onClick={() => judge('L')} className={s.leftBtn}>
          {step.leftLabel}
        </button>
        <button type="button" onClick={() => judge('R')} className={s.rightBtn}>
          {step.rightLabel}
        </button>
      </div>
    </div>
  );
}
