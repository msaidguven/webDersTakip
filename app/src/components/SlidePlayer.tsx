'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';

// Her "section" slaydına, sırayla değişen bir renk vurgusu atanıyor — konu boyunca
// hep aynı mor tonu görmek yerine slayttan slayta hafif bir renk değişimi, aynı içeriğin
// tek düze/sıkıcı hissetmesini engelliyor. Marka rengi (#6C63FF) hâlâ chrome/navigasyonda
// sabit kalıyor, bu palet sadece slayt içeriğinde (madde numarası, üst çizgi, görsel çerçevesi).
const ACCENTS = [
  { bar: '#6C63FF', soft: '#EDEBFF' },
  { bar: '#2E9E83', soft: '#E3F5EF' },
  { bar: '#D97706', soft: '#FEF3E2' },
  { bar: '#2563AF', soft: '#E5EFFC' },
] as const;

export default function SlidePlayer({ deck, onClose }: { deck: SlideDeck; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  // Bir "section" slaydına ilk girildiğinde madde listesi tek seferde değil, ok tuşuna/
  // "İleri"ye her basışta bir madde daha açılarak (kademeli) gösterilir — öğretmenin sınıfta
  // konuşma temposuna uysun, öğrenci kendi başına çalışırken de adım adım özümsesin diye.
  const [revealedCount, setRevealedCount] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = deck.slides.length;
  const slide = deck.slides[index];
  const isLast = index === total - 1;
  const showTip = isLast && !!deck.tip?.content;
  const accent = ACCENTS[index % ACCENTS.length];
  const bulletsLeft = slide.kind === 'section' ? Math.max(0, slide.bullets.length - revealedCount) : 0;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
    setRevealedCount(1);
  }, []);

  const goNext = useCallback(() => {
    if (bulletsLeft > 0) {
      setRevealedCount((c) => c + 1);
      return;
    }
    setIndex((i) => Math.min(total - 1, i + 1));
    setRevealedCount(1);
  }, [bulletsLeft, total]);

  const jumpTo = useCallback((i: number) => {
    setIndex(i);
    setRevealedCount(1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Tam ekrandaysak Escape'i tarayıcı zaten fullscreen'den çıkmak için kullanır —
        // sunumu da kapatırsak öğretmen tek Escape'te hem tam ekrandan hem sunumdan çıkar,
        // bu şaşırtıcı olur. Sadece tam ekran değilken sunumu kapat.
        if (!document.fullscreenElement) onClose();
      } else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight' || e.key === ' ') goNext();
    };
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [onClose, goPrev, goNext]);

  const cleanSvg = useMemo(() => (slide.diagramSvg ? sanitizeMathSvg(slide.diagramSvg) : null), [slide.diagramSvg]);
  const imageOnRight = index % 2 === 0;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-3 sm:p-6">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran sunum modu'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

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
        disabled={index === total - 1 && bulletsLeft === 0}
        aria-label="Sonraki"
        className="absolute right-2 sm:right-6 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="flex flex-col items-center gap-3 w-full max-w-5xl">
        <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-1.5 transition-colors duration-500" style={{ backgroundColor: accent.bar }} />

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
              <div className={`flex flex-1 min-h-0 gap-4 ${(slide.imageUrl || cleanSvg) && !imageOnRight ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2.5 justify-center">
                  {slide.bullets.length ? (
                    slide.bullets.map((bullet, i) => {
                      const revealed = i < revealedCount;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border px-2.5 sm:px-4 py-1.5 sm:py-2.5 transition-all duration-300 ${revealed ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1.5 pointer-events-none'}`}
                          style={{ borderColor: revealed ? `${accent.bar}33` : 'transparent', backgroundColor: revealed ? accent.soft : 'transparent' }}
                        >
                          <span
                            className="flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-black text-white"
                            style={{ backgroundColor: accent.bar }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-[11px] sm:text-sm font-medium text-slate-700 leading-snug">{bullet}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs sm:text-sm italic text-slate-400">İçerik özetlenemedi</p>
                  )}
                </div>
                {(slide.imageUrl || cleanSvg) && (
                  <div className="hidden sm:flex w-[36%] shrink-0 items-center justify-center rounded-2xl border p-3 overflow-hidden" style={{ borderColor: `${accent.bar}33`, backgroundColor: accent.soft }}>
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

        <div className="flex items-center gap-1.5 sm:gap-2">
          {deck.slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jumpTo(i)}
              aria-label={`${i + 1}. slayta git`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? '1.5rem' : '0.375rem',
                backgroundColor: i === index ? '#ffffff' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
