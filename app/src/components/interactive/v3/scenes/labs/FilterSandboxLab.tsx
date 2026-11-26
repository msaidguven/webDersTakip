'use client';

// Motor 1: Canlı Filtre / Kural Laboratuvarı (filter_sandbox).
// Tek bakışta anlaşılır, kaydırmasız (viewport-fit) tasarım:
// Üstte tek satır görev + canlı sayaç → Ortada aç/kapa (toggle) filtre anahtarları → Altta kompakt 2×2 öğe kartları.
import { useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import type { V3FilterSandboxVisual } from '@/app/src/lib/interactiveLesson/typesV3';
import { ACCENT_PALETTES, ITEM_JEWELS, type AccentKey } from './labTheme';

export function FilterSandboxLab({
  visual,
  accent = 'sky',
  soundOn = true,
  onComplete,
}: {
  visual: V3FilterSandboxVisual;
  accent?: AccentKey;
  soundOn?: boolean;
  onComplete?: () => void;
}) {
  const palette = ACCENT_PALETTES[accent];
  const jewels = ITEM_JEWELS[accent];
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const completedRef = useRef(false);

  const activeSet = useMemo(() => new Set(activeIds), [activeIds]);
  const goalSet = useMemo(() => new Set(visual.goalFilterIds), [visual.goalFilterIds]);

  const isGoalReached =
    goalSet.size > 0 &&
    activeSet.size === goalSet.size &&
    visual.goalFilterIds.every((id) => activeSet.has(id));

  const matchingCount = useMemo(
    () =>
      visual.items.filter((item) =>
        activeIds.every((fid) => item.matches.includes(fid)),
      ).length,
    [activeIds, visual.items],
  );

  const activeFilters = useMemo(
    () => visual.filters.filter((f) => activeSet.has(f.id)),
    [activeSet, visual.filters],
  );

  const showQueryBar = Boolean(
    visual.baseQuery || visual.filters.some((f) => Boolean(f.queryToken)),
  );

  const toggleFilter = (id: string) => {
    lessonSound().unlock();
    const next = activeSet.has(id)
      ? activeIds.filter((x) => x !== id)
      : [...activeIds, id];
    setActiveIds(next);

    const nextSet = new Set(next);
    const reached =
      goalSet.size > 0 &&
      nextSet.size === goalSet.size &&
      visual.goalFilterIds.every((gid) => nextSet.has(gid));

    if (reached) {
      if (!completedRef.current) {
        completedRef.current = true;
        if (onComplete) onComplete();
        else if (soundOn) lessonSound().sfx('ok');
      } else if (soundOn) {
        lessonSound().sfx('ok');
      }
    } else if (soundOn) {
      lessonSound().sfx('tap');
    }
  };

  const resetFilters = () => {
    if (!activeIds.length) return;
    lessonSound().unlock();
    if (soundOn) lessonSound().sfx('tap');
    setActiveIds([]);
  };

  const gridClass =
    visual.items.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className="flex w-full flex-col gap-2.5 px-1 py-0.5 sm:gap-3 sm:px-2">
      {/* Tek Satır Net Görev + Kompakt Sayaç */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="m-0 font-extrabold leading-snug"
          style={{ fontSize: 'var(--fs-label)', color: palette.titleText }}
        >
          {visual.task}
        </p>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 font-extrabold transition-colors ${
            isGoalReached
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          {isGoalReached && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />}
          <span>
            {matchingCount}/{visual.items.length} kaldı
          </span>
        </span>
      </div>

      {/* Canlı Sorgu Çubuğu (yalnızca arama/operatör konularında görünür) */}
      {showQueryBar && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-slate-100">
          <Search className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 font-mono font-bold"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            {visual.baseQuery && <span className="text-white">{visual.baseQuery}</span>}
            {activeFilters.map((f) => (
              <span
                key={f.id}
                className="rounded-md bg-sky-500/25 px-1.5 py-0.5 text-sky-200 ring-1 ring-sky-400/50"
              >
                {f.queryToken || f.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Aç/Kapa Filtre Çubuğu (Gerçek toggle anahtarı hissi — 1 saniyede anlaşılır) */}
      <div
        className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border px-3 py-2"
        style={{ background: palette.headerBg, borderColor: palette.headerBorder }}
      >
        <span
          className="font-extrabold text-slate-500"
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          Filtre seç:
        </span>

        {visual.filters.map((filter, idx) => {
          const active = activeSet.has(filter.id);
          const jewel = jewels[idx % jewels.length];
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleFilter(filter.id)}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-1 font-extrabold transition-all duration-150 active:scale-[0.98] ${
                active
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
              style={
                active
                  ? { background: jewel.badge, fontSize: 'var(--fs-sm)' }
                  : { fontSize: 'var(--fs-sm)' }
              }
            >
              {/* Mini Toggle Anahtarı */}
              <span
                aria-hidden="true"
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  active ? 'bg-white/30' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                    active ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span>{filter.label}</span>
            </button>
          );
        })}

        {activeIds.length > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            title="Filtreleri temizle"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Filtreleri sıfırla"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Kompakt Öğe Kartları (Yalnızca Başlık + Kısa Özellik, Sıfır Taşma) */}
      <div className={`grid w-full gap-2 ${gridClass}`}>
        {visual.items.map((item) => {
          const matchesAll = activeIds.every((fid) => item.matches.includes(fid));
          const isHighlighted = matchesAll && activeIds.length > 0;
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                !matchesAll
                  ? 'border-slate-200 bg-slate-100/80 opacity-40'
                  : isGoalReached
                    ? 'border-emerald-300 bg-emerald-50/75 shadow-sm'
                    : isHighlighted
                      ? 'border-sky-300 bg-sky-50/50 shadow-sm'
                      : 'border-slate-200 bg-white'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black transition-colors ${
                  !matchesAll
                    ? 'bg-slate-200 text-slate-500'
                    : isGoalReached
                      ? 'bg-emerald-500 text-white'
                      : isHighlighted
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 text-slate-400'
                }`}
              >
                {!matchesAll ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`truncate font-extrabold leading-tight ${
                    matchesAll ? 'text-slate-900' : 'text-slate-500 line-through'
                  }`}
                  style={{ fontSize: 'var(--fs-label)' }}
                >
                  {item.title}
                </span>
                {item.meta && (
                  <span
                    className="truncate font-semibold text-slate-500"
                    style={{ fontSize: 'var(--fs-sm)' }}
                  >
                    {item.meta}
                  </span>
                )}
              </div>

              {item.badge && matchesAll && (
                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600">
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Canlı Dönüt (Yalnızca gerektiğinde açılır) */}
      {(isGoalReached || matchingCount === 0) && (
        <div aria-live="polite">
          {isGoalReached ? (
            <div
              className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 font-bold text-emerald-900"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{visual.successNote}</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 font-bold text-amber-900"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              <span>Hepsi elendi! Bir filtreyi kapatıp tekrar dene.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
