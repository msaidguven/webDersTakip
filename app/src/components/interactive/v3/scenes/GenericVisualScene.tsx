'use client';

// Genel Konular İçin v3 Yapısal Görsel Sahne (Gemini AI worker ile üretilen tüm derslerde kullanılır).
// Web/masaüstünde yatay sahne oranına uygun dengeli, tek-kalan (orphan) kutusuz infografik akış;
// mobilde dikey okunaklı, dokunsal derinlikli kartlar. Bölümün vurgu rengiyle (accent) otomatik uyumludur.
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Equal,
  Layers,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { V3BeatVisual, V3Section } from '@/app/src/lib/interactiveLesson/typesV3';

type AccentKey = V3Section['accent'];

type AccentPalette = {
  headerBg: string;
  headerBorder: string;
  badgeBg: string;
  cardBorder: string;
  cardShadow: string;
  topStrip: string;
  stepConnector: string;
  titleText: string;
  softIconBg: string;
};

const ACCENT_PALETTES: Record<AccentKey, AccentPalette> = {
  sky: {
    headerBg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 55%, #eef2ff 100%)',
    headerBorder: '#bae6fd',
    badgeBg: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
    cardBorder: '#bae6fd',
    cardShadow: '0 4px 0 #bae6fd, 0 10px 22px rgba(2, 132, 199, 0.08)',
    topStrip: 'linear-gradient(90deg, #38bdf8 0%, #2563eb 100%)',
    stepConnector: '#0284c7',
    titleText: '#0c4a6e',
    softIconBg: '#e0f2fe',
  },
  amber: {
    headerBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 58%, #fff7ed 100%)',
    headerBorder: '#fde68a',
    badgeBg: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    cardBorder: '#fcd34d',
    cardShadow: '0 4px 0 #fde68a, 0 10px 22px rgba(217, 119, 6, 0.09)',
    topStrip: 'linear-gradient(90deg, #fbbf24 0%, #ea580c 100%)',
    stepConnector: '#d97706',
    titleText: '#78350f',
    softIconBg: '#fef3c7',
  },
  emerald: {
    headerBg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 58%, #f0fdfa 100%)',
    headerBorder: '#a7f3d0',
    badgeBg: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
    cardBorder: '#6ee7b7',
    cardShadow: '0 4px 0 #a7f3d0, 0 10px 22px rgba(5, 150, 105, 0.09)',
    topStrip: 'linear-gradient(90deg, #34d399 0%, #0d9488 100%)',
    stepConnector: '#059669',
    titleText: '#064e3b',
    softIconBg: '#d1fae5',
  },
  rose: {
    headerBg: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 58%, #fdf2f8 100%)',
    headerBorder: '#fecdd3',
    badgeBg: 'linear-gradient(135deg, #f43f5e 0%, #db2777 100%)',
    cardBorder: '#fda4af',
    cardShadow: '0 4px 0 #fecdd3, 0 10px 22px rgba(225, 29, 72, 0.08)',
    topStrip: 'linear-gradient(90deg, #fb7185 0%, #db2777 100%)',
    stepConnector: '#e11d48',
    titleText: '#881337',
    softIconBg: '#ffe4e6',
  },
};

// Her madde/kart için birbirinden hafifçe ayrışan uyumlu mücevher tonları (görsel ayırt edicilik)
const ITEM_JEWELS: Record<
  AccentKey,
  Array<{ badge: string; badgeShadow: string; strip: string; border: string; softBg: string }>
> = {
  sky: [
    {
      badge: 'linear-gradient(145deg, #38bdf8 0%, #0284c7 100%)',
      badgeShadow: '0 3px 0 #0369a1, 0 6px 12px rgba(2, 132, 199, 0.28)',
      strip: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
      border: '#bae6fd',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f4faff 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #818cf8 0%, #4f46e5 100%)',
      badgeShadow: '0 3px 0 #3730a3, 0 6px 12px rgba(79, 70, 229, 0.26)',
      strip: 'linear-gradient(90deg, #818cf8 0%, #4f46e5 100%)',
      border: '#c7d2fe',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f6f7ff 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #2dd4bf 0%, #0d9488 100%)',
      badgeShadow: '0 3px 0 #115e59, 0 6px 12px rgba(13, 148, 136, 0.26)',
      strip: 'linear-gradient(90deg, #2dd4bf 0%, #0d9488 100%)',
      border: '#99f6e4',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f2fdfb 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #fbbf24 0%, #d97706 100%)',
      badgeShadow: '0 3px 0 #b45309, 0 6px 12px rgba(217, 119, 6, 0.25)',
      strip: 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)',
      border: '#fde68a',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #fffdf5 100%)',
    },
  ],
  amber: [
    {
      badge: 'linear-gradient(145deg, #fbbf24 0%, #d97706 100%)',
      badgeShadow: '0 3px 0 #b45309, 0 6px 12px rgba(217, 119, 6, 0.26)',
      strip: 'linear-gradient(90deg, #fbbf24 0%, #d97706 100%)',
      border: '#fde68a',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #fffdf4 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #fb923c 0%, #ea580c 100%)',
      badgeShadow: '0 3px 0 #c2410c, 0 6px 12px rgba(234, 88, 12, 0.26)',
      strip: 'linear-gradient(90deg, #fb923c 0%, #ea580c 100%)',
      border: '#fed7aa',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #38bdf8 0%, #0284c7 100%)',
      badgeShadow: '0 3px 0 #0369a1, 0 6px 12px rgba(2, 132, 199, 0.25)',
      strip: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
      border: '#bae6fd',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f4faff 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #34d399 0%, #059669 100%)',
      badgeShadow: '0 3px 0 #047857, 0 6px 12px rgba(5, 150, 105, 0.25)',
      strip: 'linear-gradient(90deg, #34d399 0%, #059669 100%)',
      border: '#a7f3d0',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f3fdf8 100%)',
    },
  ],
  emerald: [
    {
      badge: 'linear-gradient(145deg, #34d399 0%, #059669 100%)',
      badgeShadow: '0 3px 0 #047857, 0 6px 12px rgba(5, 150, 105, 0.26)',
      strip: 'linear-gradient(90deg, #34d399 0%, #059669 100%)',
      border: '#a7f3d0',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f3fdf8 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #2dd4bf 0%, #0d9488 100%)',
      badgeShadow: '0 3px 0 #115e59, 0 6px 12px rgba(13, 148, 136, 0.26)',
      strip: 'linear-gradient(90deg, #2dd4bf 0%, #0d9488 100%)',
      border: '#99f6e4',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f2fdfb 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #38bdf8 0%, #0284c7 100%)',
      badgeShadow: '0 3px 0 #0369a1, 0 6px 12px rgba(2, 132, 199, 0.25)',
      strip: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
      border: '#bae6fd',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f4faff 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #818cf8 0%, #4f46e5 100%)',
      badgeShadow: '0 3px 0 #3730a3, 0 6px 12px rgba(79, 70, 229, 0.25)',
      strip: 'linear-gradient(90deg, #818cf8 0%, #4f46e5 100%)',
      border: '#c7d2fe',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f6f7ff 100%)',
    },
  ],
  rose: [
    {
      badge: 'linear-gradient(145deg, #fb7185 0%, #e11d48 100%)',
      badgeShadow: '0 3px 0 #be123c, 0 6px 12px rgba(225, 29, 72, 0.26)',
      strip: 'linear-gradient(90deg, #fb7185 0%, #e11d48 100%)',
      border: '#fecdd3',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #fff6f7 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #a78bfa 0%, #7c3aed 100%)',
      badgeShadow: '0 3px 0 #6d28d9, 0 6px 12px rgba(124, 58, 237, 0.26)',
      strip: 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)',
      border: '#ddd6fe',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f9f7ff 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #fb923c 0%, #ea580c 100%)',
      badgeShadow: '0 3px 0 #c2410c, 0 6px 12px rgba(234, 88, 12, 0.25)',
      strip: 'linear-gradient(90deg, #fb923c 0%, #ea580c 100%)',
      border: '#fed7aa',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)',
    },
    {
      badge: 'linear-gradient(145deg, #38bdf8 0%, #0284c7 100%)',
      badgeShadow: '0 3px 0 #0369a1, 0 6px 12px rgba(2, 132, 199, 0.25)',
      strip: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
      border: '#bae6fd',
      softBg: 'linear-gradient(180deg, #ffffff 0%, #f4faff 100%)',
    },
  ],
};

export function GenericVisualScene({
  visual,
  title,
  accent = 'sky',
}: {
  visual?: V3BeatVisual;
  title: string;
  accent?: AccentKey;
}) {
  const palette = ACCENT_PALETTES[accent];
  const jewels = ITEM_JEWELS[accent];

  if (!visual) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-3 py-7 text-center">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg"
          style={{ background: palette.badgeBg }}
        >
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        </span>
        <p className="m-0 font-black text-slate-900" style={{ fontSize: 'var(--fs-body)' }}>
          {title}
        </p>
      </div>
    );
  }

  if (visual.kind === 'highlight') {
    const count = visual.bullets.length;
    const maxLen = visual.bullets.reduce((m, b) => Math.max(m, b.length), 0);
    // 3 kısa madde varsa masaüstünde 3 sütunlu simetrik vitrin kartı (sağ altta boşluk/orphan kalmaz).
    // 3 uzun madde varsa 2 sütun + 3. madde tam genişlik (sm:col-span-2) ile yine sıfır boşluk.
    const useThreeCols = count === 3 && maxLen <= 62;
    const spanLastFull = count === 3 && !useThreeCols;
    const gridClass =
      count === 1
        ? 'grid-cols-1 max-w-2xl mx-auto'
        : useThreeCols
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2';

    return (
      <div className="flex w-full flex-col gap-3.5 p-1.5 sm:p-2.5">
        {/* Üst Vurgu Şeridi */}
        <div
          className="flex flex-wrap items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3"
          style={{
            background: palette.headerBg,
            borderColor: palette.headerBorder,
          }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-extrabold text-white shadow-sm"
            style={{
              background: palette.badgeBg,
              fontSize: 'var(--fs-sm)',
            }}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{visual.badge}</span>
          </span>
          <h3
            className="m-0 font-black tracking-tight"
            style={{ fontSize: 'var(--fs-choice)', color: palette.titleText }}
          >
            {visual.headline}
          </h3>
        </div>

        {/* Dengeli Mücevher Madde Kartları */}
        <div className={`grid w-full gap-3 ${gridClass}`}>
          {visual.bullets.map((b, i) => {
            const jewel = jewels[i % jewels.length];
            const isFullSpan = spanLastFull && i === count - 1;
            return (
              <div
                key={i}
                className={`group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border bg-white px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5 sm:px-5 sm:py-4 ${
                  isFullSpan ? 'sm:col-span-2' : ''
                }`}
                style={{
                  borderColor: jewel.border,
                  background: jewel.softBg,
                  boxShadow: `0 4px 0 ${jewel.border}, 0 8px 18px rgba(15, 23, 42, 0.05)`,
                }}
              >
                {/* Üst Renkli Vurgu Çizgisi */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1"
                  style={{ background: jewel.strip }}
                />

                {/* 3B Mücevher Numara Rozeti */}
                <span
                  className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-black text-white sm:h-9 sm:w-9"
                  style={{
                    background: jewel.badge,
                    boxShadow: jewel.badgeShadow,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 top-1 h-2.5 rounded-full bg-white/30"
                  />
                  <span className="relative">{i + 1}</span>
                </span>

                <span
                  className="font-extrabold leading-snug text-slate-800"
                  style={{ fontSize: 'var(--fs-label)' }}
                >
                  {b}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (visual.kind === 'compare') {
    return (
      <div className="relative grid w-full grid-cols-1 gap-3.5 p-1.5 sm:grid-cols-2 sm:gap-5 sm:p-2">
        {/* Sol Karşılaştırma Kartı */}
        <div
          className="flex flex-col overflow-hidden rounded-2xl border-2 border-sky-200 bg-white"
          style={{ boxShadow: '0 5px 0 #bae6fd, 0 10px 22px rgba(2, 132, 199, 0.08)' }}
        >
          <div
            className="flex items-center gap-2.5 px-4 py-3 text-white"
            style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)' }}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/20 text-xs font-black">
              A
            </span>
            <h4 className="m-0 font-black tracking-tight" style={{ fontSize: 'var(--fs-choice)' }}>
              {visual.left.title}
            </h4>
          </div>
          <ul className="m-0 flex flex-1 list-none flex-col gap-2 bg-sky-50/45 p-3.5">
            {visual.left.points.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-white px-3.5 py-2.5 font-bold leading-snug text-slate-800 shadow-sm"
                style={{ fontSize: 'var(--fs-label)' }}
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Masaüstü Orta Karşılaştırma Madalyonu */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-slate-200 bg-white text-slate-600 shadow-md sm:grid"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </span>

        {/* Sağ Karşılaştırma Kartı */}
        <div
          className="flex flex-col overflow-hidden rounded-2xl border-2 border-amber-200 bg-white"
          style={{ boxShadow: '0 5px 0 #fde68a, 0 10px 22px rgba(217, 119, 6, 0.08)' }}
        >
          <div
            className="flex items-center gap-2.5 px-4 py-3 text-white"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/20 text-xs font-black">
              B
            </span>
            <h4 className="m-0 font-black tracking-tight" style={{ fontSize: 'var(--fs-choice)' }}>
              {visual.right.title}
            </h4>
          </div>
          <ul className="m-0 flex flex-1 list-none flex-col gap-2 bg-amber-50/45 p-3.5">
            {visual.right.points.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-white px-3.5 py-2.5 font-bold leading-snug text-slate-800 shadow-sm"
                style={{ fontSize: 'var(--fs-label)' }}
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500"
                />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (visual.kind === 'steps') {
    const horizontalOnDesktop = visual.items.length <= 4;
    return (
      <div
        className={`w-full p-1.5 sm:p-2.5 ${
          horizontalOnDesktop
            ? 'flex flex-col items-stretch gap-2 sm:flex-row sm:items-stretch sm:justify-center sm:gap-2'
            : 'mx-auto flex max-w-2xl flex-col items-stretch gap-2'
        }`}
      >
        {visual.items.map((item, i) => {
          const jewel = jewels[i % jewels.length];
          return (
            <div
              key={i}
              className={
                horizontalOnDesktop
                  ? 'flex flex-col items-center sm:flex-1 sm:flex-row sm:items-center sm:gap-2'
                  : 'flex flex-col items-center'
              }
            >
              <div
                className="relative flex h-full w-full items-center gap-3 overflow-hidden rounded-2xl border bg-white px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5 sm:flex-col sm:items-start sm:justify-start sm:gap-2.5 sm:p-4"
                style={{
                  borderColor: jewel.border,
                  background: jewel.softBg,
                  boxShadow: `0 4px 0 ${jewel.border}, 0 8px 18px rgba(15, 23, 42, 0.05)`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1"
                  style={{ background: jewel.strip }}
                />
                <span
                  className="inline-flex h-7 shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-black text-white shadow-sm"
                  style={{ background: jewel.badge }}
                >
                  {i + 1}. Adım
                </span>
                <span
                  className="font-extrabold leading-snug text-slate-900"
                  style={{ fontSize: 'var(--fs-label)' }}
                >
                  {item}
                </span>
              </div>
              {i < visual.items.length - 1 && (
                <>
                  <span
                    aria-hidden="true"
                    className={`my-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm ${
                      horizontalOnDesktop ? 'sm:hidden' : ''
                    }`}
                    style={{ color: palette.stepConnector }}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                  {horizontalOnDesktop && (
                    <span
                      aria-hidden="true"
                      className="hidden h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm sm:grid"
                      style={{ color: palette.stepConnector }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (visual.kind === 'equation') {
    return (
      <div className="flex w-full flex-wrap items-center justify-center gap-2.5 p-2.5 sm:gap-3.5 sm:p-4">
        {visual.inputs.map((inp, i) => {
          const jewel = jewels[i % jewels.length];
          return (
            <div key={i} className="flex items-center gap-2.5 sm:gap-3.5">
              <span
                className="relative overflow-hidden rounded-2xl border bg-white px-4 py-3 font-extrabold text-slate-900 sm:px-5 sm:py-3.5"
                style={{
                  fontSize: 'var(--fs-choice)',
                  borderColor: jewel.border,
                  background: jewel.softBg,
                  boxShadow: `0 4px 0 ${jewel.border}, 0 8px 18px rgba(15, 23, 42, 0.06)`,
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1"
                  style={{ background: jewel.strip }}
                />
                {inp}
              </span>
              {i < visual.inputs.length - 1 && (
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-sm"
                  style={{ background: palette.badgeBg }}
                >
                  <Plus className="h-4 w-4" />
                </span>
              )}
            </div>
          );
        })}
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-md"
        >
          <Equal className="h-5 w-5" />
        </span>
        <span
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-emerald-400 px-5 py-3 font-black text-emerald-950 sm:px-6 sm:py-3.5"
          style={{
            fontSize: 'var(--fs-choice)',
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            boxShadow: '0 4px 0 #34d399, 0 10px 22px rgba(16, 185, 129, 0.16)',
          }}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>{visual.result}</span>
        </span>
      </div>
    );
  }

  // cards — kart sayısına göre otomatik dengeli ızgara (orphan yok)
  const cardGridClass =
    visual.items.length === 1
      ? 'grid-cols-1 max-w-xl mx-auto'
      : visual.items.length === 2 || visual.items.length === 4
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 md:grid-cols-3';

  return (
    <div className={`grid w-full gap-3 p-1.5 sm:p-2 ${cardGridClass}`}>
      {visual.items.map((card, i) => {
        const jewel = jewels[i % jewels.length];
        return (
          <div
            key={i}
            className="relative flex flex-col gap-2 overflow-hidden rounded-2xl border bg-white p-4 text-left transition-transform duration-200 hover:-translate-y-0.5 sm:p-5"
            style={{
              borderColor: jewel.border,
              background: jewel.softBg,
              boxShadow: `0 4px 0 ${jewel.border}, 0 8px 18px rgba(15, 23, 42, 0.05)`,
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1"
              style={{ background: jewel.strip }}
            />
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black text-white shadow-sm"
                style={{ background: jewel.badge }}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span
                className="font-black leading-tight text-slate-900"
                style={{ fontSize: 'var(--fs-choice)' }}
              >
                {card.title}
              </span>
            </div>
            <span
              className="font-semibold leading-snug text-slate-700"
              style={{ fontSize: 'var(--fs-label)' }}
            >
              {card.detail}
            </span>
          </div>
        );
      })}
    </div>
  );
}
