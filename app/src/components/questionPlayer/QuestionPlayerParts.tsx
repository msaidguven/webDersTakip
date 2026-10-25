'use client';

// Test oynatıcısı (QuizClient, presentation='player') ile slayt oynatıcısının (SlidePlayer) ORTAK
// parçaları — çerçeve, üst çubuk, numara şeridi, yazı büyütme — aynı görünsünler diye (2026-09-26).
// Soru motoru 2026-10-23'ten beri TEK: QuizClient (slaytlardaki ve misafirdeki ayrı motor kaldırıldı).
// Notlar: numara şeridi kayan pencere (2026-09-22), zoom yerine sadece font büyütme (2026-09-21).
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, Plus, X } from 'lucide-react';
import type { QuizQuestion } from '@/app/src/lib/quizQuestionTypes';

// Her "section" slaydına / soruya sırayla değişen renk teması — aynı içerik tek düze
// hissetmesin diye. Marka rengi (#6C63FF) chrome/navigasyonda sabit.
export const SLIDE_ACCENTS = [
  { bar: '#6C63FF', from: '#8B7FFF', to: '#5B4FE0', soft: '#EDEBFF', glow: 'rgba(108,99,255,0.5)' },
  { bar: '#0FA37F', from: '#3FD9AE', to: '#0C8468', soft: '#E1F8F0', glow: 'rgba(15,163,127,0.5)' },
  { bar: '#E0862A', from: '#FBBB55', to: '#C86A0E', soft: '#FEF0DD', glow: 'rgba(224,134,42,0.5)' },
  { bar: '#2B7FD9', from: '#63B0F0', to: '#1B5FAE', soft: '#E4F0FD', glow: 'rgba(43,127,217,0.5)' },
] as const;
export type SlideAccent = (typeof SLIDE_ACCENTS)[number];

// Akıllı tahtadan uzaktaki öğrenciler için metin boyutu — sadece bu oturumda geçerli.
export const MIN_FONT_SCALE = 1;
export const MAX_FONT_SCALE = 5;
export const FONT_SCALE_STEP = 0.25;

// Numara şeridi: her zaman 10 numara görünür, ‹/› pencereyi 5'er kaydırır.
const PILL_WINDOW_SIZE = 10;
const PILL_PAGE_STEP = 5;

export type AnswerStatus = 'correct' | 'incorrect' | 'revealed';

export function pillWindowFor(qIndex: number, currentStart: number, total: number): number {
  if (qIndex >= currentStart && qIndex < currentStart + PILL_WINDOW_SIZE) return currentStart;
  const maxStart = Math.max(0, total - PILL_WINDOW_SIZE);
  return Math.min(maxStart, Math.floor(qIndex / PILL_PAGE_STEP) * PILL_PAGE_STEP);
}

// Aşağı kaydırınca (mobil + masaüstü — kaydırma varsa içerik sığmıyor demektir, 2026-09-27) üst çubuğu gizler, yukarı kaydırınca / en üstteyken ya da
// resetKey değişince (yeni slayt/soru) geri getirir — dar ekranda çubuk içeriğin önemli bir
// kısmını kaplıyordu (2026-09-26 isteği: "aşağı kaydırdığımda bunlar da kaysın"). Kartın içindeki
// HERHANGİ bir kaydırılabilir alanı dinler (scroll olayı kabarcıklanmaz, capture ile yakalanır),
// böylece her oynatıcının kendi iç scroll kutusunu ayrıca bağlamaya gerek kalmıyor.
const HEADER_HIDE_THRESHOLD = 8;
// Aç/kapa animasyonu (300ms) sürerken gelen scroll olayları yok sayılır — çubuk gizlenince
// içerik alanı büyüyor, tarayıcı scrollTop'u kendiliğinden düşürüyor; bu "yukarı kaydırma"
// sanılıp çubuğu geri açardı (titreme döngüsü).
const HEADER_TOGGLE_COOLDOWN_MS = 350;
function useAutoHideHeader(cardRef: RefObject<HTMLDivElement | null>, resetKey: string | number | undefined, cardKey: string | number) {
  const [state, setState] = useState<{ hidden: boolean; key: string | number | undefined }>({ hidden: false, key: resetKey });
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const lastTop = new WeakMap<EventTarget, number>();
    let hidden = false;
    let lockedUntil = 0;
    const toggle = (next: boolean) => {
      if (next === hidden) return;
      hidden = next;
      lockedUntil = performance.now() + HEADER_TOGGLE_COOLDOWN_MS;
      setState({ hidden: next, key: resetKey });
    };
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el || el.dataset.playerHeader) return;
      const top = el.scrollTop;
      const prev = lastTop.get(el);
      lastTop.set(el, top);
      // Bu alanın ilk olayı (ör. yeni soruya geçince scroll sıfırlandı) sadece başlangıç kaydı —
      // 0'dan büyük bir değere "aşağı kaydırma" sanılıp çubuk gizlenmesin.
      if (prev === undefined) return;
      if (performance.now() < lockedUntil) return;
      if (top <= 12) return toggle(false);
      const headerHeight = (card.querySelector('[data-player-header]') as HTMLElement | null)?.scrollHeight ?? 0;
      // İçerik çubuktan belirgin fazla taşmıyorsa gizlemek hem gereksiz hem titretir.
      const overflow = el.scrollHeight - el.clientHeight;
      if (top - prev > HEADER_HIDE_THRESHOLD && overflow > headerHeight + 48) toggle(true);
      else if (prev - top > HEADER_HIDE_THRESHOLD) toggle(false);
    };
    card.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => card.removeEventListener('scroll', onScroll, { capture: true });
  }, [cardRef, resetKey, cardKey]);
  // Yeni slayt/soruya geçilince (resetKey değişti) çubuk görünür — effect'te setState yok, türetilmiş.
  return state.key === resetKey && state.hidden;
}

// Kart çerçevesi: overlay'de karartılmış tam ekran, embedded'da sayfa akışında kart. Dekoratif
// blob'lar + üstteki renkli şerit dahil.
export function PlayerFrame({
  variant,
  accent,
  containerRef,
  cardKey,
  onTouchStart,
  onTouchEnd,
  children,
  outside,
  header,
  headerResetKey,
}: {
  variant: 'overlay' | 'embedded';
  accent: SlideAccent;
  containerRef?: RefObject<HTMLDivElement | null>;
  cardKey: string | number;
  onTouchStart?: (e: TouchEvent) => void;
  onTouchEnd?: (e: TouchEvent) => void;
  children: ReactNode;
  // Kartın DIŞINDA (ama çerçevenin içinde) render edilecek katmanlar — kart transform'lu
  // animasyon + overflow-hidden olduğu için içindeki position:fixed modallar kırpılırdı.
  outside?: ReactNode;
  // Üst kontrol çubuğu — mobilde aşağı kaydırınca gizlenir (bkz. useAutoHideHeader).
  header?: ReactNode;
  headerResetKey?: string | number;
}) {
  const isOverlay = variant === 'overlay';
  const cardRef = useRef<HTMLDivElement>(null);
  const headerHidden = useAutoHideHeader(cardRef, headerResetKey, cardKey);
  return (
    <div
      ref={containerRef}
      role={isOverlay ? 'dialog' : undefined}
      aria-modal={isOverlay ? true : undefined}
      className={
        isOverlay
          ? 'fixed inset-0 z-[999] flex items-center justify-center p-0 sm:p-6 transition-colors duration-700'
          : 'relative flex items-center justify-center transition-colors duration-700'
      }
      style={isOverlay ? { background: `radial-gradient(circle at 50% 20%, ${accent.glow}, transparent 55%), rgba(15, 23, 42, 0.94)` } : undefined}
    >
      <div className="flex flex-col items-center gap-3 w-full">
        <div
          key={cardKey}
          ref={cardRef}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          // Karanlık temada sahne de koyu (2026-10-12 kullanıcı kararı): sabit bg-white/slate sınıfları
          // globals.css'teki karanlık eşlemeyle tema renklerine döner; SVG görselleri .light kapta beyaz kalır.
          className={
            isOverlay
              ? // Mobilde GERÇEK tam ekran (eskiden 100dvh-4.5rem'di: üstte site başlığı, altta sayfa
                // metni görünüp "sayfa içinde küçük pencere" hissi veriyordu — 2026-09-26 geri bildirimi).
                'animate-slide-pop-in relative flex w-full h-[100dvh] sm:h-[92dvh] sm:w-[92vw] flex-col overflow-hidden rounded-none sm:rounded-2xl bg-white shadow-2xl'
              : 'animate-slide-pop-in relative flex w-full aspect-[16/10] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'
          }
        >
          <div
            className="animate-blob-drift pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent.from}55, transparent 70%)` }}
          />
          <div
            className="animate-blob-drift pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent.to}40, transparent 70%)`, animationDelay: '2.5s' }}
          />
          <div className="absolute inset-x-0 top-0 h-2 transition-colors duration-500" style={{ background: `linear-gradient(90deg, ${accent.from}, ${accent.to})` }} />
          {header && (
            // grid-rows 1fr→0fr: yüksekliği bilinmeyen içeriği yumuşakça daraltmanın CSS yolu.
            <div
              data-player-header="1"
              className={`relative z-10 grid shrink-0 transition-[grid-template-rows,opacity] duration-300 ease-out ${headerHidden ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
              aria-hidden={headerHidden || undefined}
            >
              <div className={`min-h-0 overflow-hidden ${headerHidden ? 'pointer-events-none' : ''}`}>{header}</div>
            </div>
          )}
          {children}
        </div>
      </div>
      {outside}
    </div>
  );
}

// "A− %100 A+" — eskiden küçük −/+ ikonlarıydı, kullanıcılar yazı büyütmenin varlığını fark
// etmiyordu (2026-09-26 geri bildirimi). Harf glifleri ne işe yaradığını ilk bakışta söylüyor.
export function FontScaleControl({
  fontScale,
  onChange,
  badgeStyle,
}: {
  fontScale: number;
  onChange: (next: number) => void;
  badgeStyle?: CSSProperties;
}) {
  const btn =
    'flex h-7 min-w-8 sm:h-8 sm:min-w-9 items-center justify-center gap-px rounded-md px-1.5 font-black text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div role="group" aria-label="Yazı boyutu" className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(MIN_FONT_SCALE, Math.round((fontScale - FONT_SCALE_STEP) * 100) / 100))}
        disabled={fontScale <= MIN_FONT_SCALE}
        aria-label="Yazıyı küçült"
        title="Yazıyı küçült"
        className={btn}
      >
        <span className="text-[0.6875rem] sm:text-xs">A</span>
        <Minus className="h-3 w-3" />
      </button>
      {/* min-w-8: metin +/- ile büyüyünce kutu da genişlesin, komşu butonların üstüne binmesin. */}
      <span className="min-w-8 px-0.5 text-center text-[0.625rem] sm:text-[0.6875rem] font-black text-slate-500 whitespace-nowrap tabular-nums" style={badgeStyle}>
        %{Math.round(fontScale * 100)}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX_FONT_SCALE, Math.round((fontScale + FONT_SCALE_STEP) * 100) / 100))}
        disabled={fontScale >= MAX_FONT_SCALE}
        aria-label="Yazıyı büyüt"
        title="Yazıyı büyüt"
        className={btn}
      >
        <span className="text-sm sm:text-base">A</span>
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

const ICON_BTN = 'flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition-colors bg-slate-900/60 text-white hover:bg-slate-900/80 shadow-sm';

export function OverlayWindowButtons({
  isFullscreen,
  onToggleFullscreen,
  onClose,
}: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <button type="button" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Tam ekrandan çık' : 'Tam ekran'} className={ICON_BTN}>
        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      </button>
      <button type="button" onClick={onClose} aria-label="Kapat" className={ICON_BTN}>
        <X className="h-4 w-4" />
      </button>
    </>
  );
}

// Tam ekran API'si (toggle + durum takibi) — sunum/test modalı ortak.
export function useFullscreen(containerRef: RefObject<HTMLDivElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else containerRef.current?.requestFullscreen?.().catch(() => {});
  }, [containerRef]);
  return { isFullscreen, toggle };
}

export function QuestionPills({
  questions,
  qIndex,
  answeredMap,
  pillStart,
  setPillStart,
  onJump,
  accentBar,
  isJumpable,
}: {
  questions: QuizQuestion[];
  qIndex: number;
  answeredMap: Record<number, AnswerStatus>;
  pillStart: number;
  setPillStart: (updater: (s: number) => number) => void;
  onJump: (i: number) => void;
  accentBar: string;
  // Kayıtlı testte henüz ulaşılmamış bir soruya atlanamaz (kopya/atlama önlemi) — verilmezse hepsi serbest.
  isJumpable?: (i: number) => boolean;
}) {
  const maxStart = Math.max(0, questions.length - PILL_WINDOW_SIZE);
  // Pencere tüm soruları kapsıyorsa ‹/› hep pasif kalırdı — sadece kaydıracak bir şey varsa göster.
  const hasMultiplePages = maxStart > 0;
  return (
    <div className="flex items-center gap-1">
      {hasMultiplePages && (
        <button
          type="button"
          onClick={() => setPillStart((s) => Math.max(0, s - PILL_PAGE_STEP))}
          disabled={pillStart === 0}
          aria-label="Önceki sorular"
          className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/10 disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex items-center gap-1">
        {questions.slice(pillStart, pillStart + PILL_WINDOW_SIZE).map((q, iInWindow) => {
          const i = pillStart + iInWindow;
          const status = answeredMap[q.id];
          const isCurrent = i === qIndex;
          const cls =
            status === 'correct'
              ? 'bg-emerald-500 text-white'
              : status === 'incorrect'
                ? 'bg-rose-500 text-white'
                : status === 'revealed'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-900/10 text-slate-500';
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(i)}
              disabled={isJumpable ? !isJumpable(i) : false}
              aria-label={`${i + 1}. soruya git`}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] sm:text-[0.6875rem] font-black transition-all disabled:cursor-not-allowed disabled:opacity-40 ${cls} ${isCurrent ? 'ring-2 ring-offset-1' : ''}`}
              style={isCurrent ? ({ ['--tw-ring-color' as string]: accentBar } as CSSProperties) : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {hasMultiplePages && (
        <button
          type="button"
          onClick={() => setPillStart((s) => Math.min(maxStart, s + PILL_PAGE_STEP))}
          disabled={pillStart >= maxStart}
          aria-label="Sonraki sorular"
          className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/10 disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// Üst kontrol çubuğu / alt gezinme satırı — mobilde çentik ve ana ekran çubuğu (safe-area) payı dahil.
export const PLAYER_TOP_BAR_CLASS =
  'relative z-10 flex shrink-0 flex-col gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-5';
export const PLAYER_NAV_ROW_CLASS =
  'relative z-10 flex shrink-0 items-center justify-center gap-3 sm:gap-4 px-3 pt-1.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4 sm:pt-2';
// Üst çubuktaki küçük rozetlerin (sayaç, D/Y) ortak tabanı — eskiden mobilde 9px'ti.
export const PLAYER_BADGE_CLASS = 'rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[0.6875rem] sm:text-xs font-black shadow-sm';

// "6. SINIF · DERS · ÜNİTE" rozeti. Eskiden 9px (mobil) / 11px'ti, yazı büyütmeden etkilenmiyordu
// ve mobilde tek satıra kırpılıp ünite adı hiç görünmüyordu (2026-09-26 geri bildirimi). Artık
// daha büyük, mobilde 2 satıra kadar sarıyor ve yazı boyutuyla (en fazla 2 katına kadar) büyüyor.
export function PlayerEyebrow({ text, accent, fontScale = 1 }: { text: string; accent: SlideAccent; fontScale?: number }) {
  return (
    // Satır sınırı (line-clamp) iç SPAN'da: dolgu (padding) aynı elemanda olunca kırpılan 3. satır
    // alt dolgudan yarım görünüyordu (320px iPhone SE'de yakalandı).
    <div
      className="w-fit max-w-full rounded-lg px-2.5 py-1.5 text-[0.6875rem] leading-snug sm:text-xs font-black uppercase tracking-wide text-white shadow-sm"
      style={{
        background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
        ...(fontScale !== 1 ? { fontSize: `${0.75 * Math.min(fontScale, 2)}rem` } : undefined),
      }}
    >
      <span className="line-clamp-2 sm:line-clamp-1">{text}</span>
    </div>
  );
}

export const NAV_BTN_CLASS =
  'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors bg-slate-900/60 text-white hover:bg-slate-900/80 shadow-sm';

// Parmakla yatay kaydırma → ileri/geri. Dikey kaydırmayla (soru içinde scroll) karışmasın diye
// yatay mesafe dikeyden belirgin büyük olmalı.
const SWIPE_MIN_DISTANCE = 48;
export function useSwipe(onNext: () => void, onPrev: () => void, disabled = false) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || disabled) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onNext();
      else onPrev();
    },
    [onNext, onPrev, disabled]
  );
  return { onTouchStart, onTouchEnd };
}
