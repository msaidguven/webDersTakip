'use client';

import { useState } from 'react';
import type { V2SliderStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function SliderGame({ step, onReact, onComplete }: { step: V2SliderStep } & GameCallbacks) {
  const [value, setValue] = useState(0);
  const [explored, setExplored] = useState(false);

  const active = value >= 50 ? step.right : step.left;

  const handleChange = (v: number) => {
    setValue(v);
    if (v >= 80 && !explored) {
      setExplored(true);
      onReact(
        'happy',
        step.feedback ?? 'Harika! İki durumu karşılaştırarak farkı kendi gözlerinle gördün.',
        'ok',
        'ok',
      );
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className={s.sliderBox}>
        <span className={s.sliderBadge}>{active.label}</span>
        <div className={s.sliderVisual} aria-hidden="true">
          {active.emoji}
        </div>
        <p className={s.sliderCaption}>{active.text}</p>
        <div className="flex w-full flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => handleChange(Number(e.target.value))}
            className={s.rangeInput}
            aria-label="Karşılaştırma sürgüsü"
          />
          <div className="flex justify-between text-xs font-extrabold text-slate-500">
            <span>{step.leftTag ?? `◀ ${step.left.label}`}</span>
            <span>{step.rightTag ?? `${step.right.label} ▶`}</span>
          </div>
        </div>
      </div>

      <button type="button" disabled={!explored} onClick={onComplete} className={s.goBtn}>
        {explored ? 'Devam →' : 'Keşfetmek için sürgüyü sağa kaydır →'}
      </button>
    </div>
  );
}
