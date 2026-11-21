'use client';

// v2 oyun arayüzü için özgün, kalın konturlu SVG rozetler ve parçalar.
// Emojiler yerine gerçek mobil oyun hissi veren vektör ikonlar; tanınmayan ifadelerde emoji yedeği korunur.
import type { V2PartIconId } from '@/app/src/lib/interactiveLesson/typesV2';

function inferIcon(icon?: V2PartIconId, emoji?: string): V2PartIconId | null {
  if (icon) return icon;
  if (!emoji) return null;
  if (emoji.includes('⚙')) return 'gear';
  if (emoji.includes('🧭') || emoji.includes('📡')) return 'radar';
  if (emoji.includes('🧪') || emoji.includes('🧬')) return 'tube';
  if (emoji.includes('🛡')) return 'shield';
  if (emoji.includes('🔑') || emoji.includes('🗝')) return 'key';
  if (emoji.includes('🔍') || emoji.includes('🔎') || emoji.includes('🔬')) return 'lens';
  if (emoji.includes('💎') || emoji.includes('🔮')) return 'crystal';
  if (emoji.includes('⚡') || emoji.includes('🔋')) return 'bolt';
  if (emoji.includes('🌿') || emoji.includes('🥗') || emoji.includes('🌱')) return 'leaf';
  return null;
}

export function PartIconSvg({
  icon,
  emoji,
  className = 'h-7 w-7',
}: {
  icon?: V2PartIconId;
  emoji?: string;
  className?: string;
}) {
  const kind = inferIcon(icon, emoji);
  if (!kind) {
    return (
      <span className="inline-flex items-center justify-center leading-none" aria-hidden="true">
        {emoji ?? '★'}
      </span>
    );
  }

  switch (kind) {
    case 'gear':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path
            d="M21 5h6l1.5 5.2a14 14 0 0 1 4.4 1.8l4.7-2.6 4.2 4.2-2.6 4.7c.8 1.4 1.4 2.8 1.8 4.4L46 24v6l-5.2 1.5a14 14 0 0 1-1.8 4.4l2.6 4.7-4.2 4.2-4.7-2.6a14 14 0 0 1-4.4 1.8L27 46h-6l-1.5-5.2a14 14 0 0 1-4.4-1.8l-4.7 2.6-4.2-4.2 2.6-4.7a14 14 0 0 1-1.8-4.4L2 30v-6l5.2-1.5a14 14 0 0 1 1.8-4.4l-2.6-4.7 4.2-4.2 4.7 2.6a14 14 0 0 1 4.4-1.8L21 5Z"
            fill="#FBBF24"
            stroke="#1B2440"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="25.5" r="8.5" fill="#FEF3C7" stroke="#1B2440" strokeWidth="2.8" />
          <circle cx="24" cy="25.5" r="3.5" fill="#F97316" />
        </svg>
      );
    case 'radar':
    case 'compass':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <circle cx="24" cy="24" r="19" fill="#38BDF8" stroke="#1B2440" strokeWidth="3" />
          <circle cx="24" cy="24" r="13" fill="#0F172A" stroke="#7DD3FC" strokeWidth="1.8" />
          <circle cx="24" cy="24" r="7" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
          <path d="M24 12l5 12-5 12-5-12 5-12Z" fill="#FB7185" stroke="#1B2440" strokeWidth="2" strokeLinejoin="round" />
          <path d="M24 24l5 0-5 12-5-12 5 0Z" fill="#E2E8F0" stroke="#1B2440" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="24" cy="24" r="2.8" fill="#FFD166" stroke="#1B2440" strokeWidth="1.8" />
        </svg>
      );
    case 'tube':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <rect x="16" y="7" width="16" height="5" rx="2.5" fill="#94A3B8" stroke="#1B2440" strokeWidth="2.6" />
          <path
            d="M18 12h12v21a6 6 0 0 1-12 0V12Z"
            fill="#E0F2FE"
            stroke="#1B2440"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          <path d="M18 24h12v9a6 6 0 0 1-12 0v-9Z" fill="#22C55E" />
          <path d="M18 24c2.5-2 5.5 2 12 0" stroke="#86EFAC" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="22" cy="30" r="2" fill="#DCFCE7" />
          <circle cx="26.5" cy="27" r="1.4" fill="#DCFCE7" />
          <path d="M21 15v5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path
            d="M24 5L40 11v12c0 10.5-6.8 17.8-16 20-9.2-2.2-16-9.5-16-20V11L24 5Z"
            fill="#8B5CF6"
            stroke="#1B2440"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M24 10l11 4.2v8.6c0 7.5-4.7 12.8-11 14.5-6.3-1.7-11-7-11-14.5v-8.6L24 10Z"
            fill="#A78BFA"
          />
          <path d="M17.5 24l4.5 4.5 9-9.5" stroke="#FFFBEB" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'key':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <circle cx="16" cy="24" r="10" fill="#FACC15" stroke="#1B2440" strokeWidth="3" />
          <circle cx="16" cy="24" r="4" fill="#FFFBEB" stroke="#1B2440" strokeWidth="2.2" />
          <path d="M26 24h17v6h-4v-3h-4v3h-4v-3h-5" fill="#FACC15" stroke="#1B2440" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      );
    case 'lens':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M31 31l10 10" stroke="#1B2440" strokeWidth="6" strokeLinecap="round" />
          <path d="M31 31l10 10" stroke="#F97316" strokeWidth="3" strokeLinecap="round" />
          <circle cx="21" cy="21" r="13" fill="#BAE6FD" stroke="#1B2440" strokeWidth="3" />
          <circle cx="21" cy="21" r="8" fill="#E0F2FE" />
          <path d="M15 17a7 7 0 0 1 6-3" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    case 'crystal':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M24 4L38 18L24 44L10 18L24 4Z" fill="#38BDF8" stroke="#1B2440" strokeWidth="3" strokeLinejoin="round" />
          <path d="M24 4L31 18L24 44L17 18L24 4Z" fill="#7DD3FC" />
          <path d="M10 18h28" stroke="#1B2440" strokeWidth="2.2" />
        </svg>
      );
    case 'bolt':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M27 4L10 26h12l-3 18 19-24H26l1-16Z" fill="#FDE047" stroke="#1B2440" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      );
    case 'leaf':
      return (
        <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
          <path d="M39 9C21 9 11 19 11 37c18 0 28-10 28-28Z" fill="#34D399" stroke="#1B2440" strokeWidth="3" strokeLinejoin="round" />
          <path d="M11 37C19 29 27 21 35 13" stroke="#1B2440" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );
  }
}

export function LockBadgeSvg({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <path d="M11 16v-4a7 7 0 0 1 14 0v4" stroke="#F8FAFC" strokeWidth="3.4" strokeLinecap="round" />
      <rect x="7" y="15" width="22" height="16" rx="5" fill="#CBD5E1" stroke="#334155" strokeWidth="2.4" />
      <circle cx="18" cy="22" r="2.6" fill="#334155" />
      <path d="M18 24.5V27" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function StarSvg({ filled, className = 'h-5 w-5' }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 3l3.9 7.9 8.7 1.3-6.3 6.1 1.5 8.7L16 22.9 8.2 27l1.5-8.7-6.3-6.1 8.7-1.3L16 3Z"
        fill={filled ? '#FACC15' : 'rgba(255,255,255,0.22)'}
        stroke={filled ? '#92400E' : 'rgba(255,255,255,0.45)'}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {filled && <path d="M14.2 9.2l1.8-3.6 1.8 3.6" stroke="#FEF9C3" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}

export function StreakFlameSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" className={className} aria-hidden="true">
      <path
        d="M15.5 2.5c.6 4.4-2.8 6.4-2.8 9.2 0 1.4 1 2.4 2.2 2.4 1.5 0 2.6-1.4 2.8-3.5 3.4 2.2 5.3 5.5 5.3 9A9 9 0 0 1 5 19.6c0-5.4 4.1-9.7 10.5-17.1Z"
        fill="#FF7A29"
        stroke="#7C2D12"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M14 14.5c2 2 3.2 3.8 3.2 5.7a3.5 3.5 0 1 1-7 0c0-1.9 1.4-3.7 3.8-5.7Z" fill="#FDE047" />
    </svg>
  );
}

export function TrophyBadgeSvg({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
      <path d="M11 7h14v9a7 7 0 0 1-14 0V7Z" fill="#FACC15" stroke="#1B2440" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M11 10H6.5a3.5 3.5 0 0 0 3.5 6h1.5M25 10h4.5a3.5 3.5 0 0 1-3.5 6H24.5" stroke="#1B2440" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M18 23v5M12 31h12l-1.5-3h-9L12 31Z" fill="#F59E0B" stroke="#1B2440" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}
