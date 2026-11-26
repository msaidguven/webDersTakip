'use client';

// Motor 3: Değiştir & Gör (cause_effect_dial).
// Öğrenci 2-3 kademeli değişkeni (ör. Sıcaklık: Düşük / Orta / Yüksek, Şifre Karmaşıklığı vb.)
// tek dokunuşla değiştirdikçe gösterge ve gözlem sonuçları anında güncellenir.
// Tüm kademeler gezilince çıkarım ("takeaway") açılır ve onComplete tetiklenir.
import { useRef, useState } from 'react';
import { Check, Gauge, SlidersHorizontal, Sparkles } from 'lucide-react';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import type { V3CauseEffectDialVisual } from '@/app/src/lib/interactiveLesson/typesV3';
import { ACCENT_PALETTES, ITEM_JEWELS, type AccentKey } from './labTheme';

export function CauseEffectDialLab({
  visual,
  accent = 'sky',
  soundOn = true,
  onComplete,
}: {
  visual: V3CauseEffectDialVisual;
  accent?: AccentKey;
  soundOn?: boolean;
  onComplete?: () => void;
}) {
  const palette = ACCENT_PALETTES[accent];
  const jewels = ITEM_JEWELS[accent];
  const [activeIdx, setActiveIdx] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const completedRef = useRef(false);

  const total = visual.states.length;
  const activeState = visual.states[activeIdx] ?? visual.states[0];
  const activeJewel = jewels[activeIdx % jewels.length];
  const allVisited = visited.length >= total;

  const handleSelect = (idx: number) => {
    if (idx === activeIdx) return;
    lessonSound().unlock();
    setActiveIdx(idx);

    const nextVisited = visited.includes(idx) ? visited : [...visited, idx];
    if (nextVisited.length !== visited.length) {
      setVisited(nextVisited);
    }

    if (nextVisited.length >= total && !completedRef.current) {
      completedRef.current = true;
      if (onComplete) onComplete();
      else if (soundOn) lessonSound().sfx('ok');
    } else if (soundOn) {
      lessonSound().sfx('tap');
    }
  };

  if (!activeState) return null;

  const stateGridClass = total === 3 ? 'grid-cols-3' : 'grid-cols-2';
  const effectsGridClass = activeState.effects.length >= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1';

  return (
    <div className="flex w-full flex-col items-center gap-3 px-1 py-1 sm:gap-3.5 sm:px-2">
      {/* Üst Satır: Değişken Etiketi + Gezilen Kademe İlerlemesi */}
      <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white shadow-sm"
            style={{ background: palette.badgeBg }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <p
            className="m-0 font-extrabold leading-snug"
            style={{ fontSize: 'var(--fs-label)', color: palette.titleText }}
          >
            {visual.controlLabel}
          </p>
        </div>

        <div
          className="flex items-center gap-1.5"
          aria-label={`${visited.length} / ${total} kademe incelendi`}
        >
          {visual.states.map((_, i) => {
            const isSeen = visited.includes(i);
            const isCurrent = i === activeIdx;
            return (
              <span
                key={i}
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  allVisited
                    ? 'w-5 bg-emerald-500'
                    : isCurrent
                      ? 'w-5 bg-sky-500'
                      : isSeen
                        ? 'w-3.5 bg-emerald-400'
                        : 'w-2.5 bg-slate-200'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 2 veya 3 Kademeli Dokunmatik Seçici */}
      <div
        role="radiogroup"
        aria-label={visual.controlLabel}
        className={`grid w-full max-w-2xl gap-2 rounded-2xl border p-1.5 ${stateGridClass}`}
        style={{
          background: palette.headerBg,
          borderColor: palette.headerBorder,
        }}
      >
        {visual.states.map((st, idx) => {
          const isCurrent = idx === activeIdx;
          const isSeen = visited.includes(idx);
          const jewel = jewels[idx % jewels.length];
          return (
            <button
              key={st.label}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              onClick={() => handleSelect(idx)}
              className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2 font-black transition-all duration-150 active:scale-[0.98] ${
                isCurrent
                  ? 'text-white shadow-md'
                  : 'border border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
              }`}
              style={
                isCurrent
                  ? {
                      background: jewel.badge,
                      boxShadow: jewel.badgeShadow,
                      fontSize: 'var(--fs-sm)',
                    }
                  : { fontSize: 'var(--fs-sm)' }
              }
            >
              {isSeen && (
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${isCurrent ? 'text-white' : 'text-emerald-500'}`}
                  aria-hidden="true"
                />
              )}
              <span className="truncate">{st.label}</span>
            </button>
          );
        })}
      </div>

      {/* Canlı Sonuç Kartı */}
      <div
        className="relative flex w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-2xl border-2 bg-white px-4 py-3.5 transition-all duration-200 sm:px-5 sm:py-4"
        style={{
          borderColor: allVisited ? '#6ee7b7' : activeJewel.border,
          background: activeJewel.softBg,
          boxShadow: allVisited
            ? '0 4px 0 #a7f3d0, 0 8px 18px rgba(16, 185, 129, 0.1)'
            : `0 4px 0 ${activeJewel.border}, 0 8px 18px rgba(15, 23, 42, 0.05)`,
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1 transition-all duration-300"
          style={{ background: activeJewel.strip }}
        />

        {/* Başlık + Opsiyonel Doluluk Göstergesi */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <h4
              className="m-0 font-black tracking-tight text-slate-900"
              style={{ fontSize: 'var(--fs-choice)' }}
            >
              {activeState.headline}
            </h4>
          </div>
          {activeState.meter !== undefined && (
            <span
              className="rounded-full px-2.5 py-0.5 font-extrabold text-white shadow-sm"
              style={{ background: activeJewel.badge, fontSize: 'var(--fs-sm)' }}
            >
              %{activeState.meter}
            </span>
          )}
        </div>

        {activeState.meter !== undefined && (
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.max(4, Math.min(100, activeState.meter))}%`,
                background: activeJewel.strip,
              }}
            />
          </div>
        )}

        {/* Gözlem Maddeleri */}
        <div className={`grid w-full gap-2 ${effectsGridClass}`}>
          {activeState.effects.map((eff, i) => (
            <div
              key={`${activeIdx}-${i}`}
              className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 font-bold leading-snug text-slate-800 shadow-sm"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              <span
                aria-hidden="true"
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: activeJewel.badge }}
              />
              <span>{eff}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tüm Kademeler Gezilince Çıkan Özet Çıkarım */}
      {allVisited ? (
        <div
          className="flex w-full max-w-2xl items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-center font-bold text-emerald-900"
          style={{ fontSize: 'var(--fs-sm)' }}
          aria-live="polite"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>{visual.takeaway}</span>
        </div>
      ) : (
        <p className="m-0 text-center font-bold text-slate-500" style={{ fontSize: 'var(--fs-sm)' }}>
          Farkı görmek için diğer kademelere de dokun ({visited.length}/{total}).
        </p>
      )}
    </div>
  );
}
