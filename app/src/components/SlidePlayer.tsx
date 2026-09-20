'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, ZoomIn } from 'lucide-react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';

// Her "section" slaydına, sırayla değişen bir renk teması atanıyor — konu boyunca hep aynı
// mor tonu görmek yerine slayttan slayta renk değişimi, aynı içeriğin tek düze/sıkıcı
// hissetmesini engelliyor. Marka rengi (#6C63FF) hâlâ chrome/navigasyonda sabit kalıyor,
// bu palet slayt içeriğinde (madde rozeti, gradyan şerit, dekoratif şekiller, görsel çerçevesi).
const ACCENTS = [
  { bar: '#6C63FF', from: '#8B7FFF', to: '#5B4FE0', soft: '#EDEBFF', glow: 'rgba(108,99,255,0.5)' },
  { bar: '#0FA37F', from: '#3FD9AE', to: '#0C8468', soft: '#E1F8F0', glow: 'rgba(15,163,127,0.5)' },
  { bar: '#E0862A', from: '#FBBB55', to: '#C86A0E', soft: '#FEF0DD', glow: 'rgba(224,134,42,0.5)' },
  { bar: '#2B7FD9', from: '#63B0F0', to: '#1B5FAE', soft: '#E4F0FD', glow: 'rgba(43,127,217,0.5)' },
] as const;

// Görsel/diyagram olmayan section slaytları için dekoratif, konu-nötr bir desen — her slayt
// bomboş/yazı-yığını gibi hissetmesin diye. Rastgele değil (SSR/hydration'da tutarlı olsun
// diye slaytKey'e göre deterministik), gerçek bir görselin yerine geçmiyor ama boşluğu
// renkli/canlı tutuyor.
function DecorativePattern({ seed, from, to }: { seed: number; from: string; to: string }) {
  const rings = [0.9, 0.65, 0.4];
  const rotate = (seed * 37) % 360;
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" style={{ transform: `rotate(${rotate}deg)` }}>
      <defs>
        <linearGradient id={`slide-decor-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      {rings.map((r, i) => (
        <circle
          key={i}
          cx="100"
          cy="100"
          r={80 * r}
          fill="none"
          stroke={`url(#slide-decor-${seed})`}
          strokeWidth={i === rings.length - 1 ? 10 : 3}
          strokeDasharray={i % 2 === 0 ? '2 10' : undefined}
          opacity={0.55 - i * 0.12}
        />
      ))}
      <circle cx="100" cy="100" r="22" fill={`url(#slide-decor-${seed})`} opacity={0.85} />
    </svg>
  );
}

export default function SlidePlayer({ deck, onClose }: { deck: SlideDeck; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  // Bir "section" slaydına ilk girildiğinde madde listesi tek seferde değil, ok tuşuna/
  // "İleri"ye her basışta bir madde daha açılarak (kademeli) gösterilir — öğretmenin sınıfta
  // konuşma temposuna uysun, öğrenci kendi başına çalışırken de adım adım özümsesin diye.
  const [revealedCount, setRevealedCount] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);
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
    setAnimKey((k) => k + 1);
  }, []);

  const goNext = useCallback(() => {
    if (bulletsLeft > 0) {
      setRevealedCount((c) => c + 1);
      return;
    }
    setIndex((i) => Math.min(total - 1, i + 1));
    setRevealedCount(1);
    setAnimKey((k) => k + 1);
  }, [bulletsLeft, total]);

  const jumpTo = useCallback((i: number) => {
    setIndex(i);
    setRevealedCount(1);
    setAnimKey((k) => k + 1);
  }, []);

  // Kilitli (henüz açılmamış) bir maddeye tıklayınca o maddeye kadar hepsini aç — "İleri"ye
  // art arda basmak yerine öğretmen/öğrenci istediği maddeye doğrudan atlayabilsin.
  const revealUpTo = useCallback((bulletIndex: number) => {
    setRevealedCount((c) => Math.max(c, bulletIndex + 1));
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
        if (lightboxSrc) return; // ayrı bir click-outside/X ile kapanıyor, aşağıda ele alınıyor
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
  }, [onClose, goPrev, goNext, lightboxSrc]);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSrc(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxSrc]);

  const cleanSvg = useMemo(() => (slide.diagramSvg ? sanitizeMathSvg(slide.diagramSvg) : null), [slide.diagramSvg]);
  const imageOnRight = index % 2 === 0;
  const visualSrc = slide.imageUrl;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6 transition-colors duration-700"
      style={{ background: `radial-gradient(circle at 50% 20%, ${accent.glow}, transparent 55%), rgba(15, 23, 42, 0.94)` }}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
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
        className="absolute left-2 sm:left-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={goNext}
        disabled={index === total - 1 && bulletsLeft === 0}
        aria-label="Sonraki"
        className="absolute right-2 sm:right-6 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="flex flex-col items-center gap-3 w-full max-w-5xl">
        <div key={animKey} className="animate-slide-pop-in relative w-full aspect-video overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Dekoratif, dolaşan renkli blob'lar — kartın arka planına derinlik katıyor */}
          <div
            className="animate-blob-drift pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent.from}55, transparent 70%)` }}
          />
          <div
            className="animate-blob-drift pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent.to}40, transparent 70%)`, animationDelay: '2.5s' }}
          />

          <div className="absolute inset-x-0 top-0 h-2 transition-colors duration-500" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />

          {deck.eyebrowText && (
            <div
              className="absolute left-4 top-5 sm:left-6 sm:top-7 rounded-lg px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black uppercase tracking-wide text-white shadow-sm"
              style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }}
            >
              {deck.eyebrowText}
            </div>
          )}
          <div className="absolute right-4 top-5 sm:right-6 sm:top-7 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[9px] sm:text-[11px] font-black text-slate-500 shadow-sm">
            {index + 1}/{total}
          </div>

          {slide.kind === 'cover' ? (
            <div
              className="relative flex h-full items-center gap-6 overflow-hidden px-6 sm:px-12 pt-16"
              style={{ background: `linear-gradient(135deg, ${accent.from}22, white 55%)` }}
            >
              <div className={slide.imageUrl ? 'relative z-[1] flex-1 min-w-0' : 'relative z-[1] w-full'}>
                <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-slate-800 leading-tight">{slide.heading}</h1>
                {slide.subtitle && <p className="mt-3 text-xs sm:text-base text-slate-500 font-medium max-w-xl">{slide.subtitle}</p>}
              </div>
              {slide.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setLightboxSrc(slide.imageUrl)}
                  className="group relative z-[1] hidden sm:flex h-[72%] aspect-square shrink-0 items-center justify-center rounded-2xl p-1.5 shadow-lg cursor-zoom-in"
                  style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                >
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-white p-3">
                    <img src={slide.imageUrl} alt={slide.heading} className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <ZoomIn className="absolute bottom-2 right-2 h-6 w-6 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ) : (
                <div className="animate-float-slow relative z-[1] hidden sm:flex h-[65%] aspect-square shrink-0 items-center justify-center opacity-90">
                  <DecorativePattern seed={index + 1} from={accent.from} to={accent.to} />
                </div>
              )}
            </div>
          ) : (
            <div className="relative flex h-full flex-col px-4 sm:px-8 pt-16 pb-4 sm:pb-8">
              <h2 className="text-base sm:text-2xl font-black text-slate-800 mb-3 sm:mb-5 shrink-0">{slide.heading}</h2>
              <div className={`relative z-[1] flex flex-1 min-h-0 gap-4 ${!imageOnRight ? 'flex-row-reverse' : ''}`}>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2.5 justify-center">
                  {slide.bullets.length ? (
                    slide.bullets.map((bullet, i) => {
                      const revealed = i < revealedCount;
                      const isNextUp = i === revealedCount;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => revealUpTo(i)}
                          disabled={revealed}
                          className={`flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-left transition-all duration-300 ${
                            revealed
                              ? 'opacity-100 translate-y-0 shadow-sm'
                              : isNextUp
                                ? 'opacity-40 cursor-pointer hover:opacity-70'
                                : 'opacity-0 -translate-y-1.5 pointer-events-none'
                          }`}
                          style={{
                            borderColor: revealed ? `${accent.bar}33` : 'transparent',
                            background: revealed ? `linear-gradient(90deg, ${accent.soft}, white)` : 'transparent',
                          }}
                        >
                          <span
                            className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-[9px] sm:text-[10px] font-black text-white shadow"
                            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-[11px] sm:text-sm font-medium text-slate-700 leading-snug">{bullet}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs sm:text-sm italic text-slate-400">İçerik özetlenemedi</p>
                  )}
                </div>

                <div
                  className="hidden sm:flex w-[38%] shrink-0 items-center justify-center rounded-2xl p-1.5 overflow-hidden shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${accent.from}30, ${accent.to}18)` }}
                >
                  {visualSrc ? (
                    <button
                      type="button"
                      onClick={() => setLightboxSrc(visualSrc)}
                      className="group relative h-full w-full flex items-center justify-center rounded-xl bg-white p-3 cursor-zoom-in overflow-hidden"
                    >
                      <img src={visualSrc} alt={slide.heading} className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                      <ZoomIn className="absolute bottom-2 right-2 h-5 w-5 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ) : cleanSvg ? (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-white p-3 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: cleanSvg }} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 opacity-80">
                      <DecorativePattern seed={index + 1} from={accent.from} to={accent.to} />
                    </div>
                  )}
                </div>
              </div>
              {showTip && deck.tip && (
                <div className="relative z-[1] mt-3 shrink-0 rounded-xl border border-[#F5C453] bg-gradient-to-r from-[#FFF7E6] to-[#FFEFC9] px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs shadow-sm">
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
                width: i === index ? '1.75rem' : '0.5rem',
                background: i === index ? `linear-gradient(90deg, ${accent.from}, ${accent.to})` : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-6 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            aria-label="Görseli kapat"
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
