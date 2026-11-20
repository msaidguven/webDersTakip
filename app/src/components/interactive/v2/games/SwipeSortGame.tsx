'use client';

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

  const judge = (side: 'L' | 'R') => {
    if (locked.current || done || !current) return;
    if (current.side === side) {
      locked.current = true;
      setDx(0);
      setAnim(side === 'L' ? 'outL' : 'outR');
      onReact('happy', 'Doğru karar! 👏', 'ok', 'ok');
      window.setTimeout(() => {
        setAnim('none');
        locked.current = false;
        if (idx + 1 < step.items.length) {
          setIdx((k) => k + 1);
          onReact('normal', step.say, 'normal');
        } else {
          setDone(true);
          onReact('happy', `🎉 ${step.feedback ?? 'Süper! Tüm kartları doğru yerleştirdin.'}`, 'ok', 'ok');
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

  const tiltBorder = dx < -35 ? '#15b8d9' : dx > 35 ? '#ff7a29' : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center text-xs font-extrabold text-slate-500">
        {idx + 1} / {step.items.length}
      </div>

      <div>
        <div
          className={`${s.swipeCard} ${dragging ? s.swipeDragging : ''} ${
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
            if (dx < -65) judge('L');
            else if (dx > 65) judge('R');
            else setDx(0);
          }}
          onPointerCancel={() => {
            setDragging(false);
            setDx(0);
          }}
        >
          {current.text}
        </div>
        <p className="mt-1.5 text-center text-xs font-bold text-slate-400">← Sola/Sağa kaydır veya düğmeye dokun →</p>
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
