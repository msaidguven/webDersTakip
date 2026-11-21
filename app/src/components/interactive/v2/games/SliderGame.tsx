'use client';

// Etkileşimli Deney Sürgüsü: 0 → 100 arasında iki durumun görsel dönüşümünü canlı izle.
import { useState } from 'react';
import type { V2SliderStep } from '@/app/src/lib/interactiveLesson/typesV2';
import type { GameCallbacks } from './KavramAviGame';
import s from '../v2.module.css';

export function SliderGame({ step, onReact, onComplete }: { step: V2SliderStep } & GameCallbacks) {
  const [value, setValue] = useState(0);
  const [explored, setExplored] = useState(false);

  const isRight = value >= 50;
  const active = isRight ? step.right : step.left;
  const ratio = value / 100;

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
      <div
        className={s.sliderBox}
        style={{
          background: isRight
            ? 'linear-gradient(155deg, #e0f7ff 0%, #f0f9ff 100%)'
            : 'linear-gradient(155deg, #fff4df 0%, #fffaf0 100%)',
        }}
      >
        {/* Çift durumlu laboratuvar üst göstergesi */}
        <div className="flex w-full items-center justify-between gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
              !isRight ? 'bg-amber-500 text-white shadow-sm' : 'bg-white/70 text-slate-500'
            }`}
          >
            {step.left.label}
          </span>
          <span className="text-xs font-black text-slate-600">%{value}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
              isRight ? 'bg-sky-500 text-white shadow-sm' : 'bg-white/70 text-slate-500'
            }`}
          >
            {step.right.label}
          </span>
        </div>

        {/* Görsel dönüşüm alanı */}
        <div className={s.sliderStage} aria-hidden="true">
          <span
            className={s.sliderOrbIcon}
            style={{
              opacity: 1 - ratio * 0.85,
              transform: `scale(${1.08 - ratio * 0.35}) translateX(${-ratio * 24}px)`,
            }}
          >
            {step.left.emoji}
          </span>
          <span className={s.sliderSparkBar}>
            <i style={{ width: `${value}%` }} />
          </span>
          <span
            className={s.sliderOrbIcon}
            style={{
              opacity: 0.25 + ratio * 0.75,
              transform: `scale(${0.75 + ratio * 0.35}) translateX(${(1 - ratio) * 24}px)`,
            }}
          >
            {step.right.emoji}
          </span>
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
