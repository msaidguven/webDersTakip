import type { V3Section } from '@/app/src/lib/interactiveLesson/typesV3';

export type AccentKey = V3Section['accent'];

export type AccentPalette = {
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

export type JewelTone = {
  badge: string;
  badgeShadow: string;
  strip: string;
  border: string;
  softBg: string;
};

export const ACCENT_PALETTES: Record<AccentKey, AccentPalette> = {
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
export const ITEM_JEWELS: Record<AccentKey, JewelTone[]> = {
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
