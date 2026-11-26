'use client';

// Motor 2: Çip Birleştirici (token_builder).
// Tek bakışta anlaşılır, ortalanmış, kaydırmasız (viewport-fit) tasarım:
// Üstte tek satır görev → Ortada oklarla/artılarla bağlı hedefler (sıradaki yuva vurgulu) → Altta seçilebilir çipler.
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Lightbulb, Plus, RotateCcw, Sparkles, X } from 'lucide-react';
import { lessonSound } from '@/app/src/lib/interactiveLesson/sound';
import type { V3TokenBuilderVisual } from '@/app/src/lib/interactiveLesson/typesV3';
import { ACCENT_PALETTES, ITEM_JEWELS, type AccentKey } from './labTheme';

function matchesSolution(
  picked: string[],
  solution: string[],
  anyOrder?: boolean,
): boolean {
  if (picked.length !== solution.length) return false;
  if (anyOrder) {
    const a = [...picked].sort((x, y) => x.localeCompare(y, 'tr-TR'));
    const b = [...solution].sort((x, y) => x.localeCompare(y, 'tr-TR'));
    return a.every((val, i) => val === b[i]);
  }
  return picked.every((val, i) => val === solution[i]);
}

function shuffleTokenOrder(
  tokens: string[],
  solution: string[],
  anyOrder?: boolean,
): number[] {
  const order = tokens.map((_, i) => i);
  if (order.length <= 1) return order;

  const isSameAsSolutionPrefix = (cand: number[]) =>
    !anyOrder &&
    cand.length >= solution.length &&
    solution.every((val, i) => tokens[cand[i]] === val);

  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (!isSameAsSolutionPrefix(order)) break;
  }

  // Son çare: hâlâ çözüm sırasıyla başlıyorsa ilk iki elemanı değiştir
  if (isSameAsSolutionPrefix(order) && order.length >= 2) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

export function TokenBuilderLab({
  visual,
  accent = 'sky',
  soundOn = true,
  onComplete,
}: {
  visual: V3TokenBuilderVisual;
  accent?: AccentKey;
  soundOn?: boolean;
  onComplete?: () => void;
}) {
  const palette = ACCENT_PALETTES[accent];
  const jewels = ITEM_JEWELS[accent];
  const [displayOrder] = useState<number[]>(() =>
    shuffleTokenOrder(visual.tokens, visual.solution, visual.anyOrder),
  );
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const completedRef = useRef(false);

  const targetLen = visual.solution.length;
  const selectedTokens = useMemo(
    () => selectedIndices.map((idx) => visual.tokens[idx] ?? ''),
    [selectedIndices, visual.tokens],
  );

  const isFull = selectedIndices.length === targetLen;
  const isSolved = isFull && matchesSolution(selectedTokens, visual.solution, visual.anyOrder);
  const isWrong = isFull && !isSolved;

  const handlePickToken = (tokenIdx: number) => {
    if (isSolved || selectedIndices.includes(tokenIdx) || selectedIndices.length >= targetLen) {
      return;
    }
    lessonSound().unlock();
    const nextIndices = [...selectedIndices, tokenIdx];
    setSelectedIndices(nextIndices);

    if (nextIndices.length === targetLen) {
      const nextTokens = nextIndices.map((i) => visual.tokens[i] ?? '');
      if (matchesSolution(nextTokens, visual.solution, visual.anyOrder)) {
        if (!completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
          else if (soundOn) lessonSound().sfx('ok');
        } else if (soundOn) {
          lessonSound().sfx('ok');
        }
      } else if (soundOn) {
        lessonSound().sfx('retry');
      }
    } else if (soundOn) {
      lessonSound().sfx('tap');
    }
  };

  const handleRemoveSlot = (slotIdx: number) => {
    if (isSolved) return;
    lessonSound().unlock();
    if (soundOn) lessonSound().sfx('tap');
    setSelectedIndices((prev) => prev.filter((_, i) => i !== slotIdx));
  };

  const handleReset = () => {
    if (!selectedIndices.length) return;
    lessonSound().unlock();
    if (soundOn) lessonSound().sfx('tap');
    setSelectedIndices([]);
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

      {/* Ortalanmış Kurulum Şeridi (Sıralıysa →, sırasızsa + ile bağlı) */}
      <div
        className={`flex w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-3 py-3 transition-colors sm:gap-2 sm:px-4 ${
          isSolved
            ? 'border-emerald-400 bg-emerald-50/75'
            : isWrong
              ? 'border-amber-400 bg-amber-50/75'
              : 'border-slate-200 bg-slate-50/85'
        }`}
      >
        {Array.from({ length: targetLen }).map((_, slotIdx) => {
          const pickedTokenIdx = selectedIndices[slotIdx];
          const isNextSlot = !isFull && slotIdx === selectedIndices.length;

          return (
            <div key={`slot-wrap-${slotIdx}`} className="flex items-center gap-1.5 sm:gap-2">
              {pickedTokenIdx === undefined ? (
                <span
                  className={`inline-flex min-h-[40px] min-w-[82px] items-center justify-center rounded-xl border-2 border-dashed px-3 py-1 font-extrabold transition-colors ${
                    isNextSlot
                      ? 'border-sky-400 bg-white text-sky-600 shadow-sm'
                      : 'border-slate-300 bg-white/60 text-slate-400'
                  }`}
                  style={{ fontSize: 'var(--fs-sm)' }}
                >
                  {visual.anyOrder ? '?' : `${slotIdx + 1}.`}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={isSolved}
                  onClick={() => handleRemoveSlot(slotIdx)}
                  title={isSolved ? visual.tokens[pickedTokenIdx] : 'Çıkarmak için dokun'}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-extrabold text-white transition-transform ${
                    isSolved ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]'
                  }`}
                  style={{
                    background: isSolved
                      ? 'linear-gradient(145deg, #34d399 0%, #059669 100%)'
                      : jewels[pickedTokenIdx % jewels.length].badge,
                    boxShadow: isSolved
                      ? '0 3px 0 #047857'
                      : jewels[pickedTokenIdx % jewels.length].badgeShadow,
                    fontSize: 'var(--fs-label)',
                  }}
                >
                  <span>{visual.tokens[pickedTokenIdx]}</span>
                  {!isSolved && <X className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />}
                </button>
              )}

              {slotIdx < targetLen - 1 && (
                <span aria-hidden="true" className="text-slate-400">
                  {visual.anyOrder ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </span>
              )}
            </div>
          );
        })}

        {selectedIndices.length > 0 && !isSolved && (
          <button
            type="button"
            onClick={handleReset}
            aria-label="Seçimi temizle"
            title="Temizle"
            className="ml-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Seçilebilir Çip Havuzu (Her açılışta karıştırılmış sıra) */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {displayOrder.map((tokenIdx, posIdx) => {
          const token = visual.tokens[tokenIdx];
          const used = selectedIndices.includes(tokenIdx);
          const jewel = jewels[posIdx % jewels.length];
          return (
            <button
              key={`${tokenIdx}-${token}`}
              type="button"
              disabled={used || isSolved || isFull}
              onClick={() => handlePickToken(tokenIdx)}
              className={`inline-flex min-h-[40px] items-center justify-center rounded-xl border-2 px-4 py-1.5 font-extrabold transition-all duration-150 ${
                used
                  ? 'cursor-default border-slate-200 bg-slate-100 text-slate-400 opacity-40'
                  : isSolved || isFull
                    ? 'cursor-default border-slate-200 bg-white text-slate-400 opacity-55'
                    : 'cursor-pointer bg-white text-slate-900 hover:-translate-y-0.5 active:translate-y-0.5'
              }`}
              style={
                !used && !isSolved && !isFull
                  ? {
                      borderColor: jewel.border,
                      background: jewel.softBg,
                      boxShadow: `0 3px 0 ${jewel.border}`,
                      fontSize: 'var(--fs-label)',
                    }
                  : { fontSize: 'var(--fs-label)' }
              }
            >
              {token}
            </button>
          );
        })}
      </div>

      {/* Canlı Sonuç veya İpucu (Yalnızca dolunca görünür) */}
      {(isSolved || isWrong) && (
        <div className="w-full" aria-live="polite">
          {isSolved ? (
            <div
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-center font-bold text-emerald-900"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>{visual.resultPreview}</span>
            </div>
          ) : (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-amber-950"
              style={{ fontSize: 'var(--fs-sm)' }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span className="font-bold leading-snug">{visual.hint}</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 font-extrabold text-white hover:bg-amber-600"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>Tekrar Dene</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
