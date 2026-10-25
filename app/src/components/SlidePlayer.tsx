'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, ListChecks, Maximize2, PartyPopper, Trophy, X, ZoomIn } from 'lucide-react';
import { sanitizeMathSvg } from '@/app/src/lib/sanitizeSvg';
import type { SlideDeck } from '@/app/src/lib/topicSlideDeck';
import { ClassroomSlideView, revealStepsLeft } from '@/app/src/components/SlideKindViews';
import { useViewportRemScale } from '@/app/src/hooks/useViewportRemScale';
import {
  SLIDE_ACCENTS as ACCENTS,
  NAV_BTN_CLASS,
  PLAYER_BADGE_CLASS,
  PLAYER_NAV_ROW_CLASS,
  PLAYER_TOP_BAR_CLASS,
  PlayerEyebrow,
  FontScaleControl,
  OverlayWindowButtons,
  PlayerFrame,
  useFullscreen,
  useSwipe,
} from '@/app/src/components/questionPlayer/QuestionPlayerParts';

// Renk paleti, yazı büyütme ve çerçeve test oynatıcısıyla ORTAK — bkz. questionPlayer/QuestionPlayerParts.tsx.

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

type SlidePlayerProps = {
  deck: SlideDeck;
  // Konu değişince sunum baştan başlasın diye (gömülü oynatıcıda deck prop'u değişebilir).
  topicId: number;
  // Sunum sonundaki "Soruları Çöz" ve üst çubuktaki "Sorulara Geç": konunun standart testini açar
  // (2026-10-23 birleştirme — sorular artık burada değil, her yerdeki AYNI test oynatıcısında çözülüyor;
  // misafirde GuestTopicTest, üyede kavrama testi). Verilmezse (ör. admin önizlemesi) soru adımı yok.
  onStartTest?: () => void;
  // 'overlay' (varsayılan): tam ekranı kaplayan, karartılmış arka planlı sunum modu (Escape/X
  // ile kapanır). 'embedded': ders sayfasına gömülü, normal sayfa akışında bir kart — kapatma
  // yok, sağ üstte sadece "tam ekranda aç" (onExpand) butonu var.
  variant?: 'overlay' | 'embedded';
  onClose?: () => void;
  onExpand?: () => void;
};

export default function SlidePlayer({ deck, topicId, onStartTest, variant = 'overlay', onClose, onExpand }: SlidePlayerProps) {
  const [index, setIndex] = useState(0);
  // Bir "section" slaydına ilk girildiğinde madde listesi tek seferde değil, ok tuşuna/
  // "İleri"ye her basışta bir madde daha açılarak (kademeli) gösterilir — öğretmenin sınıfta
  // konuşma temposuna uysun, öğrenci kendi başına çalışırken de adım adım özümsesin diye.
  const [revealedCount, setRevealedCount] = useState(1);
  // Görsel (img) ile diyagram (ham SVG markup) farklı şekilde render edildiği için (biri
  // <img src>, diğeri dangerouslySetInnerHTML) lightbox'ın ikisini de büyütebilmesi için tip
  // ayrımı gerekiyor.
  const [lightbox, setLightbox] = useState<{ kind: 'image'; src: string } | { kind: 'svg'; html: string } | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const [fontScale, setFontScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(containerRef);

  // Slaytlar bitince ('outro') tebrik ekranı; oradan "Soruları Çöz" konunun testini açar (onStartTest).
  const [phase, setPhase] = useState<'slides' | 'outro'>('slides');
  // Deck/konu değişince (embedded SlidePlayer sayfada sabit kalıp deck prop'u değiştiği için)
  // her şeyi baştan başlat — aksi halde önceki konunun ortasında kalınırdı.
  useEffect(() => {
    setIndex(0);
    setRevealedCount(1);
    setPhase('slides');
    setAnimKey((k) => k + 1);
  }, [topicId]);

  const total = deck.slides.length;
  const slide = deck.slides[index];
  // İpucu kutusu son ALT BAŞLIK slaydında — artık sunum özet/tartışma slaytlarıyla bitiyor.
  const lastSectionIndex = deck.slides.findLastIndex((sl) => sl.kind === 'section');
  const showTip = phase === 'slides' && index === lastSectionIndex && !!deck.tip?.content;
  const accent = ACCENTS[index % ACCENTS.length];
  const bulletsLeft = phase === 'slides' ? revealStepsLeft(slide, revealedCount) : 0;


  const goPrev = useCallback(() => {
    if (phase === 'outro') {
      setPhase('slides');
      setAnimKey((k) => k + 1);
      return;
    }
    setIndex((i) => Math.max(0, i - 1));
    setRevealedCount(1);
    setAnimKey((k) => k + 1);
  }, [phase]);

  const goNext = useCallback(() => {
    if (phase === 'outro') {
      onStartTest?.();
      return;
    }
    if (bulletsLeft > 0) {
      setRevealedCount((c) => c + 1);
      return;
    }
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setRevealedCount(1);
      setAnimKey((k) => k + 1);
      return;
    }
    setPhase('outro');
    setAnimKey((k) => k + 1);
  }, [phase, bulletsLeft, index, total, onStartTest]);

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
  // Sınıf-içi slayt görünümleri (SlideKindViews) doğrudan hedef revealedCount'u veriyor.
  const revealToStep = useCallback((step: number) => {
    setRevealedCount((c) => Math.max(c, step));
  }, []);

  // Eskiden kaydırma (swipe) bir slaytın KALAN TÜM maddelerini birden açıyordu ("bu slaytla
  // işim bitti, sıradakine geç" niyeti) — ama mobilde artık her adımda TEK madde tam ekran
  // gösteriliyor (kullanıcının 2026-09-22 isteği), bu yüzden swipe da tıklama/"İleri" ile
  // AYNI tek-adım mantığına (goNext) bağlandı; aksi halde bir kaydırma mobildeki tüm madde
  // sayfalarını atlayıp doğrudan slaydın sonuna zıplardı.
  const { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd } = useSwipe(goNext, goPrev, !!lightbox);

  const isOverlay = variant === 'overlay';
  // Tam ekranda her şey ekran boyutuna orantılı büyür (akıllı tahta); sayfaya gömülü kartta değil.
  useViewportRemScale(isOverlay);

  // Üst çubuktaki küçük rozetler (%büyütme, D:/Y:, sayfa sayacı) +/- ile birlikte büyüsün diye
  // — eskiden sabit [9-11px] kalıyorlardı, metin kocaman olunca orantısız kalıyordu
  // (kullanıcının 2026-09-21 isteği).
  const smallBadgeStyle = useCallback(
    // rem: tam ekranda kök yazı boyutu ekrana göre büyüdüğünde (useViewportRemScale) rozetler de büyüsün.
    (basePx: number) => (fontScale !== 1 ? { fontSize: `${(basePx / 16) * fontScale}rem` } : undefined),
    [fontScale]
  );

  // Slayt (özet/kapak/tebrik) metinleri de eskiden `zoom` ile büyütülüyordu — ama zoom kutunun
  // TAMAMINI (görsel kutusu, boşluklar, sabit yükseklikli satır) büyüttüğü için, kart sabit
  // 16:9 boyda kalınca içerik card'ın dışına taşıp kırpılıyor, satırlar/görsel üst üste
  // biniyordu ("çok saçma bir şekil" — kullanıcının 2026-09-21 şikayeti). Artık test
  // oynatıcısındaki gibi SADECE metin font-size'ı (+ orantılı line-height) büyüyor, görsel kutusu ve
  // dolgular sabit kalıyor; madde listesi de taştığında kırpılmak yerine kendi içinde kayabiliyor
  // (bkz. aşağıdaki overflow-y-auto).
  const slideTextStyle = useCallback(
    (baseRem: number, lineHeight = 1.3) => (fontScale !== 1 ? { fontSize: `${baseRem * fontScale}rem`, lineHeight } : undefined),
    [fontScale]
  );

  // Klavye kısayolları (ok tuşları/boşluk/Escape) sadece overlay (tam ekran modal) modunda
  // global window listener'ı ile çalışır. Embedded (sayfaya gömülü) modda bunu global
  // dinlersek, sayfadaki bir arama kutusuna yazarken ya da başka bir formda boşluk/ok tuşuna
  // basıldığında slaytlar da kayardı — bu yüzden embedded'da klavye kısayolu yok, sadece
  // buton/tıklama ile ilerleniyor.
  useEffect(() => {
    if (!isOverlay) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) return; // ayrı bir click-outside/X ile kapanıyor, aşağıda ele alınıyor
        // Tam ekrandaysak Escape'i tarayıcı zaten fullscreen'den çıkmak için kullanır —
        // sunumu da kapatırsak öğretmen tek Escape'te hem tam ekrandan hem sunumdan çıkar,
        // bu şaşırtıcı olur. Sadece tam ekran değilken sunumu kapat.
        if (!document.fullscreenElement) onClose?.();
      } else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight' || e.key === ' ') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOverlay, onClose, goPrev, goNext, lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);


  const cleanSvg = useMemo(() => (slide.diagramSvg ? sanitizeMathSvg(slide.diagramSvg) : null), [slide.diagramSvg]);
  const imageOnRight = index % 2 === 0;
  const visualSrc = slide.imageUrl;

  // Mobilde kart neredeyse tüm genişliği/yüksekliği kapladığı için yarı saydam beyaz butonlar
  // beyaz kartın üstüne denk gelip kayboluyordu (kullanıcının 2026-09-21 bulduğu regresyon) —
  // hem overlay hem embedded'da koyu, opak bir varyant kullanılıyor; bu hem koyu backdrop hem
  // beyaz kart üstünde okunuyor.
  // Nokta göstergesi artık her zaman beyaz kartın İÇİNDE (eskiden overlay'de kartın altında,
  // koyu arka plan üstündeydi) — bu yüzden isOverlay'e göre değil, her zaman açık zeminde
  // okunan tonda (kullanıcının 2026-09-21 isteğiyle oklar/noktalar slayda taşındı).
  const inactiveDotColor = 'rgba(15,23,42,0.18)';

  return (
    <>
      {/* Çerçeve (karartılmış arka plan / gömülü kart, dekoratif blob'lar, renkli şerit)
          soru bankası test modalıyla ortak — bkz. PlayerFrame. */}
      <PlayerFrame
        variant={variant}
        accent={accent}
        containerRef={containerRef}
        cardKey={animKey}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        headerResetKey={`${phase}-${index}`}
        header={
          <div className={PLAYER_TOP_BAR_CLASS}>
            <div className="min-w-0 w-full sm:w-auto">
              {deck.eyebrowText && <PlayerEyebrow text={deck.eyebrowText} accent={accent} fontScale={fontScale} />}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1.5">
              {phase !== 'outro' && (
                <>
                  {/* Slaytların tamamını izlemeden doğrudan teste geçmek için kısayol
                      (kullanıcının 2026-09-22 "ayrı bir sekme olsa iyi olmaz mı" isteği). */}
                  {onStartTest && (
                    <button
                      type="button"
                      onClick={onStartTest}
                      aria-label="Sorulara geç"
                      title="Sorulara geç"
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/90 px-1.5 sm:px-2 py-1.5 text-[0.625rem] sm:text-[0.6875rem] font-black text-slate-500 shadow-sm transition-colors hover:bg-slate-100"
                    >
                      <ListChecks className="h-3.5 w-3.5 shrink-0" />
                      {/* Diğer üst çubuk rozetleri (%büyütme, D:/Y:, sayfa sayacı) +/- ile
                          büyüyor ama bu yazı unutulmuştu — sabit kalıyordu (kullanıcının
                          2026-09-22 bulduğu eksiklik). */}
                      <span className="hidden sm:inline" style={smallBadgeStyle(11)}>Sorulara Geç</span>
                    </button>
                  )}
                  <FontScaleControl fontScale={fontScale} onChange={setFontScale} badgeStyle={smallBadgeStyle(10)} />
                  <div className={`text-slate-500 ${PLAYER_BADGE_CLASS}`} style={smallBadgeStyle(11)}>
                    {index + 1}/{total}
                  </div>
                </>
              )}
              {isOverlay ? (
                <OverlayWindowButtons isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} onClose={onClose} />
              ) : (
                <button
                  type="button"
                  onClick={onExpand}
                  aria-label="Tam ekranda aç"
                  title="Tam ekranda aç"
                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 transition-colors shadow-sm"
                >
                  <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
          </div>
        }
      >
          {/* Tek, akışta (absolute değil) üst kontrol çubuğu — küçültme/büyütme, sayfa sayacı ve
              tam ekran/kapat butonları burada birleşiyor. Eskiden bu kontroller kartın üstüne
              absolute konumlanıyordu ve dar ekranlarda alt satıra sarınca başlığın üstüne
              biniyordu (kullanıcının 2026-09-21 bulduğu regresyon) — artık normal akışta kendi
              satırını kaplıyor, başlık her zaman bunun altından başlıyor. */}
          {/* Mobilde eskiden eyebrow rozeti (sınıf · ders · ünite zinciri, tek satırda 40+
              karakter) ile sağdaki kontrol grubu AYNI satırda yan yana sıkıştırılıyordu —
              dar ekranda rozet 3-4 satıra sarınca kontroller (büyüt/küçült, sayfa sayacı,
              tam ekran, X) rozetin yanına küçük ve sıkışık kalıyordu (kullanıcının
              2026-09-24 "üst üste/sıkışık, X butonu falan olsa iyi olur" şikayeti — buton
              zaten vardı ama görünürlüğü zayıftı). Artık mobilde iki ayrı, ferah satır:
              rozet KENDİ satırında tek satıra kırpılıyor (truncate), kontroller altında tam
              genişlikte kendi satırını kaplıyor. sm+ ekranda eskisi gibi tek satır. */}
          {phase === 'outro' ? (
            <div className="relative flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-4 text-center" style={{ background: `linear-gradient(135deg, ${accent.from}22, white 55%)` }}>
              <div
                className="relative z-[1] flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full shadow-lg shrink-0"
                style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
              >
                <Trophy className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <h2 className="relative z-[1] text-xl sm:text-3xl font-black text-slate-800" style={slideTextStyle(1.875, 1.2)}>
                <PartyPopper className="mr-2 inline h-5 w-5 sm:h-7 sm:w-7 text-amber-500" />
                Tebrikler, konuyu tamamladın!
              </h2>
              <p className="relative z-[1] max-w-md text-sm sm:text-base font-medium text-slate-500" style={slideTextStyle(1, 1.4)}>
                {deck.topicTitle} konusunu baştan sona bitirdin. Şimdi öğrendiklerini sorularla pekiştirmeye ne dersin?
              </p>
              {onStartTest && (
                <button
                  type="button"
                  onClick={onStartTest}
                  className="relative z-[1] mt-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white shadow-lg transition-transform hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                >
                  Soruları Çöz →
                </button>
              )}
            </div>
          ) : slide.kind === 'cover' ? (
            <div
              className="relative flex flex-1 min-h-0 items-center gap-6 overflow-y-auto px-6 sm:px-12 py-4 sm:py-2"
              style={{ background: `linear-gradient(135deg, ${accent.from}22, white 55%)` }}
            >
              <div className={slide.imageUrl ? 'relative z-[1] flex-1 min-w-0' : 'relative z-[1] w-full'}>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 leading-tight" style={slideTextStyle(1.875, 1.15)}>{slide.heading}</h1>
                {slide.subtitle && <p className="mt-3 text-base text-slate-500 font-medium max-w-xl" style={slideTextStyle(1, 1.4)}>{slide.subtitle}</p>}
                {deck.estimatedMinutes ? (
                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-black text-slate-500 shadow-sm" style={slideTextStyle(0.75, 1.3)}>
                    <Clock className="h-3.5 w-3.5" /> Yaklaşık {deck.estimatedMinutes} dk · {total} slayt
                  </p>
                ) : null}
              </div>
              {slide.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setLightbox({ kind: 'image', src: slide.imageUrl! })}
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
          ) : slide.kind !== 'section' ? (
            <ClassroomSlideView slide={slide} accent={accent} revealedCount={revealedCount} onReveal={revealToStep} textStyle={slideTextStyle} />
          ) : (
            <div className="relative flex flex-1 min-h-0 flex-col px-4 sm:px-8 pt-2 pb-4 sm:pb-8">
              <h2 className="text-lg sm:text-2xl font-black text-slate-800 mb-3 sm:mb-5 shrink-0" style={slideTextStyle(1.5, 1.25)}>{slide.heading}</h2>
              <div className={`relative z-[1] flex flex-1 min-h-0 gap-4 ${!imageOnRight ? 'flex-row-reverse' : ''}`}>
                {/* Madde listesi büyük font'ta sığmayabilir — eskiden zoom kartın dışına taşırıp
                    kırpıyordu, artık kendi içinde dikey kayabiliyor (kullanıcının 2026-09-21
                    "scroll ekle" isteği). */}
                {/* justify-center + overflow-y-auto birlikte kullanılınca taşan ilk madde(ler)
                    scroll alanının ÜSTÜNE (görünmeyen tarafa) denk geliyordu — kullanıcı ilk
                    maddenin "kaybolduğunu" düşünüyordu (2026-09-21). justify-start ile liste
                    her zaman baştan görünür, kısa listelerde de üstte başlaması kabul edilebilir
                    bir görünüm. Bu liste artık sadece MASAÜSTÜ (sm+) — mobil için aşağıdaki
                    tek-madde görünümüne bakın. */}
                <div className="hidden sm:flex flex-1 min-w-0 flex-col gap-2.5 justify-start overflow-y-auto py-1">
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
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-all duration-300 ${
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
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-black text-white shadow"
                            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-700 leading-snug" style={slideTextStyle(0.875, 1.4)}>{bullet}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm italic text-slate-400">İçerik özetlenemedi</p>
                  )}
                </div>

                {/* Mobil: maddeler artık alt alta BİRİKMİYOR — her dokunuşta ("İleri"/swipe,
                    ikisi de goNext'e bağlı) sadece o an açık olan TEK madde, büyük ve
                    ortalanmış yazıyla tam ekran gösteriliyor. revealedCount zaten "kaçıncı
                    madde açıldı" sayacı (masaüstündeki kademeli açılmayla AYNI state) — burada
                    "şu an gösterilecek madde" olarak yeniden kullanılıyor. Bu, tek maddelik
                    slaytlarda ekranın bomboş/yazının cılız görünmesi sorununu da çözüyor
                    (kullanıcının 2026-09-22 şikayeti): artık kaç madde olursa olsun mobilde
                    her zaman TEK bir madde, ekranı dolduracak boyutta gösteriliyor. */}
                <div className="flex sm:hidden flex-1 min-w-0 flex-col items-center justify-center gap-4 px-2 text-center">
                  {slide.bullets.length ? (
                    (() => {
                      const i = Math.min(revealedCount - 1, slide.bullets.length - 1);
                      return (
                        <>
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white shadow"
                            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
                          >
                            {i + 1}
                          </span>
                          <p className="text-lg font-bold leading-snug text-slate-700" style={slideTextStyle(1.25, 1.5)}>
                            {slide.bullets[i]}
                          </p>
                          {slide.bullets.length > 1 && (
                            <span className="text-[0.6875rem] font-black uppercase tracking-wide text-slate-400">
                              {i + 1} / {slide.bullets.length}
                            </span>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <p className="text-sm italic text-slate-400">İçerik özetlenemedi</p>
                  )}
                </div>

                <div
                  className="hidden sm:flex w-[38%] shrink-0 items-center justify-center rounded-2xl p-1.5 overflow-hidden shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${accent.from}30, ${accent.to}18)` }}
                >
                  {visualSrc ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ kind: 'image', src: visualSrc })}
                      className="light group relative h-full w-full flex items-center justify-center rounded-xl bg-white p-3 cursor-zoom-in overflow-hidden"
                    >
                      <img src={visualSrc} alt={slide.heading} className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                      <ZoomIn className="absolute bottom-2 right-2 h-5 w-5 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ) : cleanSvg ? (
                    <button
                      type="button"
                      onClick={() => setLightbox({ kind: 'svg', html: cleanSvg })}
                      className="group relative h-full w-full flex items-center justify-center rounded-xl bg-white p-3 cursor-zoom-in overflow-hidden"
                    >
                      <div
                        className="h-full w-full transition-transform duration-300 group-hover:scale-105 [&_svg]:h-full [&_svg]:w-full"
                        dangerouslySetInnerHTML={{ __html: cleanSvg }}
                      />
                      <ZoomIn className="absolute bottom-2 right-2 h-5 w-5 rounded-md bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 opacity-80">
                      <DecorativePattern seed={index + 1} from={accent.from} to={accent.to} />
                    </div>
                  )}
                </div>
              </div>
              {showTip && deck.tip && (
                <div className="relative z-[1] mt-3 shrink-0 rounded-xl border border-[#F5C453] bg-gradient-to-r from-[#FFF7E6] to-[#FFEFC9] px-3 sm:px-4 py-2 sm:py-3 text-xs shadow-sm" style={slideTextStyle(0.75, 1.35)}>
                  <span className="font-black text-amber-800">💡 {deck.tip.title}: </span>
                  <span className="text-amber-900">{deck.tip.content}</span>
                </div>
              )}
            </div>
          )}

          {/* İleri/geri okları artık ekranın kenarlarında havada değil, slaydın kendi alt
              çubuğunda — nokta göstergesiyle aynı satırda (kullanıcının 2026-09-21 isteği). */}
          <div className={PLAYER_NAV_ROW_CLASS}>
            <button
              type="button"
              onClick={goPrev}
              disabled={phase === 'slides' && index === 0}
              aria-label="Önceki"
              className={NAV_BTN_CLASS}
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>

            {phase !== 'outro' ? (
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
                      background: i === index ? `linear-gradient(90deg, ${accent.from}, ${accent.to})` : inactiveDotColor,
                    }}
                  />
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={goNext}
              // 'slides' fazında son slayttan sonra "İleri" tebrik ekranına geçer; tebrik ekranında testi açar.
              disabled={phase === 'outro' && !onStartTest}
              aria-label="Sonraki"
              className={NAV_BTN_CLASS}
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
      </PlayerFrame>

      {lightbox && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/85 p-6 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          {lightbox.kind === 'image' ? (
            <img src={lightbox.src} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
          ) : (
            <div
              className="light max-h-[85vh] w-[min(90vw,42rem)] overflow-auto rounded-lg bg-white p-6 shadow-2xl [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: lightbox.html }}
            />
          )}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Kapat"
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}
