'use client';

// v2 hazır atmosfer arka planları ve parça toplama aracı SVG'leri.
// AI çizim üretmez; yalnızca themeId ('lab-capsule' | 'time-machine' | 'explorer-compass' | 'detective-lens') seçer.
import type { V2ThemeId } from '@/app/src/lib/interactiveLesson/typesV2';
import s from './v2.module.css';

export type AtmospherePreset = {
  s1: string;
  s2: string;
  dark: boolean;
  sky: React.ReactNode;
  hills: React.ReactNode;
};

export const STOP_ATMOSPHERES: AtmospherePreset[] = [
  // Durak 1: Sıcak kehribar / güneş
  {
    s1: '#ffd88a',
    s2: '#ff9e5e',
    dark: false,
    sky: <circle cx="82%" cy="18%" r="42" fill="#fff3c4" opacity="0.9" />,
    hills: (
      <>
        <path d="M0 95Q110 25 220 75T400 55V160H0Z" fill="#e59b46" />
        <path d="M0 120Q140 70 270 112T400 95V160H0Z" fill="#c77d2c" />
      </>
    ),
  },
  // Durak 2: Okyanus mavisi / kanal
  {
    s1: '#bce6ff',
    s2: '#70bef5',
    dark: false,
    sky: (
      <g fill="#fff" opacity="0.75">
        <ellipse cx="18%" cy="18%" rx="38" ry="14" />
        <ellipse cx="78%" cy="22%" rx="48" ry="16" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 105Q120 65 240 95T400 82V160H0Z" fill="#52a8e0" />
        <path d="M0 126Q130 92 260 120T400 108V160H0Z" fill="#378cc7" />
      </>
    ),
  },
  // Durak 3: Zümrüt yeşili / enzim
  {
    s1: '#c7f6d4',
    s2: '#63cd8a',
    dark: false,
    sky: (
      <g fill="#fff" opacity="0.7">
        <ellipse cx="22%" cy="16%" rx="44" ry="15" />
        <ellipse cx="76%" cy="20%" rx="34" ry="12" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 100Q105 55 210 92T400 76V160H0Z" fill="#3eb56c" />
        <path d="M0 124Q150 86 280 118T400 102V160H0Z" fill="#299453" />
      </>
    ),
  },
  // Durak 4: Mor-lacivert final
  {
    s1: '#2c216e',
    s2: '#6649cc',
    dark: true,
    sky: (
      <g fill="#fff">
        <circle className={s.twinkle} cx="15%" cy="15%" r="3" />
        <circle className={s.twinkle} cx="82%" cy="18%" r="4" />
        <circle cx="84%" cy="32%" r="24" fill="#a78bfa" opacity="0.35" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 108Q110 58 210 95T400 72V160H0Z" fill="#46329e" />
        <path d="M0 128Q140 94 270 122T400 110V160H0Z" fill="#302078" />
      </>
    ),
  },
];

export const MAP_ATMOSPHERE: AtmospherePreset = {
  s1: '#171440',
  s2: '#3e268c',
  dark: true,
  sky: (
    <g fill="#fff">
      <circle className={s.twinkle} cx="12%" cy="12%" r="2.5" />
      <circle className={s.twinkle} cx="88%" cy="16%" r="3.5" />
      <circle className={s.twinkle} cx="25%" cy="34%" r="2" />
      <circle className={s.twinkle} cx="76%" cy="42%" r="2.5" />
      <circle cx="14%" cy="22%" r="20" fill="#ffd166" opacity="0.22" />
      <circle cx="86%" cy="28%" r="28" fill="#38bdf8" opacity="0.18" />
    </g>
  ),
  hills: (
    <>
      <path d="M0 95Q110 38 220 82T400 62V160H0Z" fill="#2a1f6e" />
      <path d="M0 122Q140 84 265 114T400 98V160H0Z" fill="#1d1552" />
    </>
  ),
};

export function AtmosphereBackdrop({ preset }: { preset: AtmospherePreset }) {
  return (
    <div
      className={s.bgLayer}
      style={{ background: `linear-gradient(180deg, ${preset.s1}, ${preset.s2})` }}
      aria-hidden="true"
    >
      <svg className={s.skySvg}>{preset.sky}</svg>
      <svg className={s.hillsSvg} viewBox="0 0 400 160" preserveAspectRatio="none">
        {preset.hills}
      </svg>
    </div>
  );
}

/** Harita panelinde ve final ödülünde parça eklendikçe güçlenen tema aracı SVG'si. */
export function ThemeDeviceSvg({
  themeId,
  collected,
  total,
}: {
  themeId: V2ThemeId;
  collected: number;
  total: number;
}) {
  const ready = collected >= total && total > 0;
  const glow = ready ? '#38bdf8' : collected >= Math.ceil(total / 2) ? '#ffd166' : '#64748b';

  if (themeId === 'lab-capsule') {
    return (
      <svg viewBox="0 0 90 90" fill="none" className="h-full w-full" aria-hidden="true">
        <circle cx="45" cy="45" r="35" stroke={glow} strokeWidth="3" strokeDasharray="6 5" opacity={collected ? 0.92 : 0.35} />
        {/* Mikro Kapsül gövdesi */}
        <rect x="24" y="25" width="42" height="40" rx="20" fill="#e2e8f0" stroke="#1b2440" strokeWidth="3" />
        <path d="M45 25H46C57.0457 25 66 33.9543 66 45C66 56.0457 57.0457 65 46 65H45V25Z" fill="#38bdf8" stroke="#1b2440" strokeWidth="3" />
        {/* Pencere */}
        <circle cx="38" cy="45" r="9" fill={glow} stroke="#1b2440" strokeWidth="2.8" />
        {collected >= 1 && <circle cx="38" cy="45" r="3.5" fill="#fff" />}
        {/* Yan sensör kanatları */}
        <path d="M24 38L14 34L17 45L14 56L24 52Z" fill="#ff7a29" stroke="#1b2440" strokeWidth="2.4" />
        {/* Hazır enerji halkası */}
        {ready && (
          <>
            <circle cx="67" cy="24" r="4" fill="#ffd166" />
            <circle cx="22" cy="68" r="3.5" fill="#22c55e" />
          </>
        )}
      </svg>
    );
  }

  // Varsayılan / time-machine / explorer-compass / detective-lens roket-pusula silueti
  return (
    <svg viewBox="0 0 90 90" fill="none" className="h-full w-full" aria-hidden="true">
      <circle cx="45" cy="46" r="34" stroke={glow} strokeWidth="3" strokeDasharray="6 5" opacity={collected ? 0.9 : 0.35} />
      <path d="M45 10C58 20 63 36 63 54H27C27 36 32 20 45 10Z" fill="#e2e8f0" stroke="#1b2440" strokeWidth="3" />
      <path d="M27 50L15 62L27 60Z" fill="#ff7a29" stroke="#1b2440" strokeWidth="2.5" />
      <path d="M63 50L75 62L63 60Z" fill="#ff7a29" stroke="#1b2440" strokeWidth="2.5" />
      <circle cx="45" cy="37" r="10" fill={glow} stroke="#1b2440" strokeWidth="3" />
      <rect x="35" y="54" width="20" height="8" rx="3" fill="#475569" />
      {collected >= 1 && <circle cx="45" cy="37" r="4" fill="#fff" />}
      {ready && (
        <>
          <path d="M38 64L45 80L52 64Z" fill="#ffd166" />
          <path d="M41 64L45 74L49 64Z" fill="#ff7a29" />
        </>
      )}
    </svg>
  );
}
