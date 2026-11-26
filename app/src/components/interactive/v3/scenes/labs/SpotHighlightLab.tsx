'use client';

// Motor 4: Olayda / Metinde Dokun-Bul (spot_highlight).
// Kısa bir günlük hayat olayı, cümle veya örnek tıklanabilir parçalara ayrılır;
// öğrenci sorulan parçaya dokunup anında öğretici dönüt alır. 1 saniyede anlaşılır, tek ekrana sığar.
import { useMemo, useRef, useState } from 'react';
import { Check, Lightbulb, Sparkles } from 'lucide-react';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import type { V3SpotHighlightVisual } from '@/app/src/lib/interactiveLesson/typesV3';
import { ACCENT_PALETTES, type AccentKey } from './labTheme';

export function SpotHighlightLab({
  visual,
  accent = 'sky',
  soundOn = true,
  onComplete,
}: {
  visual: V3SpotHighlightVisual;
  accent?: AccentKey;
  soundOn?: boolean;
  onComplete?: () => void;
}) {
  const palette = ACCENT_PALETTES[accent];
  const [foundIndices, setFoundIndices] = useState<number[]>([]);
  const [lastTappedIdx, setLastTappedIdx] = useState<number | null>(null);
  const completedRef = useRef(false);

  const targetIndices = useMemo(
    () =>
      visual.segments.reduce<number[]>((acc, seg, i) => {
        if (seg.isTarget) acc.push(i);
        return acc;
      }, []),
    [visual.segments],
  );

  const foundSet = useMemo(() => new Set(foundIndices), [foundIndices]);
  const isAllFound =
    targetIndices.length > 0 && targetIndices.every((idx) => foundSet.has(idx));

  const lastSegment = lastTappedIdx !== null ? visual.segments[lastTappedIdx] : null;

  const handleTap = (idx: number) => {
    if (isAllFound) return;
    const seg = visual.segments[idx];
    if (!seg) return;

    lessonSound().unlock();
    setLastTappedIdx(idx);

    if (seg.isTarget) {
      if (foundSet.has(idx)) return;
      const next = [...foundIndices, idx];
      setFoundIndices(next);
      const nextSet = new Set(next);
      const finished = targetIndices.every((ti) => nextSet.has(ti));

      if (finished) {
        if (!completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
          else if (soundOn) lessonSound().sfx('ok');
        } else if (soundOn) {
          lessonSound().sfx('ok');
        }
      } else if (soundOn) {
        lessonSound().sfx('ok');
      }
    } else if (soundOn) {
      lessonSound().sfx('retry');
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-3 px-1 py-1 sm:gap-3.5 sm:px-2">
      {/* Tek Satır Net Görev */}
      <p
        className="m-0 text-center font-extrabold leading-snug"
        style={{ fontSize: 'var(--fs-label)', color: palette.titleText }}
      >
        {visual.task}
      </p>

      {/* Akıcı Tıklanabilir Cümle / Olay Kartı */}
      <div
        className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border px-4 py-4 sm:px-5 sm:py-5"
        style={{
          background: palette.headerBg,
          borderColor: palette.headerBorder,
        }}
      >
        {visual.segments.map((seg, idx) => {
          const isFound = foundSet.has(idx);
          const isWrongTap = !seg.isTarget && lastTappedIdx === idx;
          return (
            <button
              key={`${idx}-${seg.text}`}
              type="button"
              disabled={isAllFound && !isFound}
              onClick={() => handleTap(idx)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 px-3.5 py-1.5 font-extrabold transition-all duration-150 ${
                isFound
                  ? 'cursor-default border-emerald-500 bg-emerald-500 text-white shadow-sm'
                  : isWrongTap
                    ? 'cursor-pointer border-amber-400 bg-amber-50 text-amber-900'
                    : isAllFound
                      ? 'cursor-default border-slate-200/70 bg-white/60 text-slate-400'
                      : 'cursor-pointer border-slate-200 bg-white text-slate-800 shadow-[0_3px_0_#cbd5e1] hover:-translate-y-0.5 hover:border-sky-300 active:translate-y-0.5'
              }`}
              style={{ fontSize: 'var(--fs-label)' }}
            >
              {isFound && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span>{seg.text}</span>
            </button>
          );
        })}
      </div>

      {/* Anlık Öğretici Dönüt */}
      {lastSegment && (
        <div className="w-full max-w-2xl" aria-live="polite">
          {lastSegment.isTarget ? (
            <div
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-center font-bold text-emerald-900"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{lastSegment.feedback}</span>
            </div>
          ) : (
            <div
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-center font-bold text-amber-900"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>{lastSegment.feedback}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
