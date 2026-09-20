'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';

export default function SlidePlayer({ deck, onClose }: { deck: SlideDeck; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const total = deck.slides.length;
  const slide = deck.slides[index];
  const isLast = index === total - 1;
  const showTip = isLast && !!deck.tip?.content;

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const cleanSvg = useMemo(() => (slide.diagramSvg ? sanitizeMathSvg(slide.diagramSvg) : null), [slide.diagramSvg]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-3 sm:p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={goPrev}
        disabled={index === 0}
        aria-label="Önceki slayt"
        className="absolute left-2 sm:left-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={goNext}
        disabled={index === total - 1}
        aria-label="Sonraki slayt"
        className="absolute right-2 sm:right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="relative w-full max-w-5xl aspect-video overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#6C63FF]" />

        {deck.eyebrowText && (
          <div className="absolute left-4 top-4 sm:left-6 sm:top-6 rounded-lg border border-[#6C63FF] bg-[#EDEBFF] px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-wide text-[#6C63FF]">
            {deck.eyebrowText}
          </div>
        )}
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black text-slate-500">
          {index + 1}/{total}
        </div>

        {slide.kind === 'cover' ? (
          <div className="flex h-full items-center gap-6 px-6 sm:px-12 pt-14">
            <div className={slide.imageUrl ? 'flex-1 min-w-0' : 'w-full'}>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-800 leading-tight">{slide.heading}</h1>
              {slide.subtitle && <p className="mt-3 text-xs sm:text-base text-slate-500 font-medium">{slide.subtitle}</p>}
            </div>
            {slide.imageUrl && (
              <div className="hidden sm:flex h-[70%] aspect-square shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <img src={slide.imageUrl} alt={slide.heading} className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col px-4 sm:px-8 pt-14 pb-4 sm:pb-8">
            <h2 className="text-base sm:text-2xl font-black text-slate-800 mb-3 sm:mb-5 shrink-0">{slide.heading}</h2>
            <div className="flex flex-1 min-h-0 gap-4">
              <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2.5 justify-center">
                {slide.bullets.length ? (
                  slide.bullets.map((bullet, i) => (
                    <div key={i} className="flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-4 py-1.5 sm:py-2.5">
                      <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0 rounded-full bg-[#6C63FF]" />
                      <span className="text-[11px] sm:text-sm font-medium text-slate-700 leading-snug">{bullet}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs sm:text-sm italic text-slate-400">İçerik özetlenemedi</p>
                )}
              </div>
              {(slide.imageUrl || cleanSvg) && (
                <div className="hidden sm:flex w-[36%] shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3 overflow-hidden">
                  {slide.imageUrl ? (
                    <img src={slide.imageUrl} alt={slide.heading} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="h-full w-full [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: cleanSvg! }} />
                  )}
                </div>
              )}
            </div>
            {showTip && deck.tip && (
              <div className="mt-3 shrink-0 rounded-lg sm:rounded-xl border border-[#F5C453] bg-[#FFF7E6] px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs">
                <span className="font-black text-amber-800">💡 {deck.tip.title}: </span>
                <span className="text-amber-900">{deck.tip.content}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
