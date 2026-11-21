'use client';

// v2 görsel dünyaları: Her tema (lab-capsule, time-machine, explorer-compass, detective-lens)
// kendine özgü katmanlı SVG atmosferlere, arka plan hareketine ve parça eklendikçe güçlenen araç çizimine sahiptir.
import type { V2ThemeId } from '@/app/src/lib/interactiveLesson/typesV2';
import s from './v2.module.css';

export type AtmospherePreset = {
  s1: string;
  s2: string;
  dark: boolean;
  sky: React.ReactNode;
  mid?: React.ReactNode;
  hills: React.ReactNode;
};

export type ThemeWorld = {
  dockLabel: string;
  attachNoun: string;
  mapAtmosphere: AtmospherePreset;
  stopAtmospheres: AtmospherePreset[];
};

// --- 1. BİLİM LABORATUVARI & MİKRO KAPSÜL (lab-capsule) ---
const LAB_MAP: AtmospherePreset = {
  s1: '#0f1742',
  s2: '#233b87',
  dark: true,
  sky: (
    <g>
      <circle className={s.twinkle} cx="14%" cy="14%" r="3" fill="#7dd3fc" />
      <circle className={s.twinkle} cx="84%" cy="18%" r="4" fill="#fde047" />
      <circle className={s.driftSlow} cx="20%" cy="32%" r="22" fill="#38bdf8" opacity="0.16" />
      <circle className={s.driftMed} cx="80%" cy="36%" r="30" fill="#a78bfa" opacity="0.16" />
      <g stroke="#38bdf8" strokeWidth="1.5" opacity="0.22" fill="none">
        <circle cx="80%" cy="36%" r="44" strokeDasharray="6 6" />
        <circle cx="20%" cy="32%" r="34" strokeDasharray="4 6" />
      </g>
    </g>
  ),
  mid: (
    <g opacity="0.18" stroke="#bae6fd" strokeWidth="1.2" fill="none">
      <line x1="0" y1="68%" x2="100%" y2="68%" strokeDasharray="4 8" />
      <line x1="0" y1="80%" x2="100%" y2="80%" strokeDasharray="4 8" />
    </g>
  ),
  hills: (
    <>
      <path d="M0 105Q95 48 195 88T400 66V160H0Z" fill="#1b2b6b" />
      <path d="M0 128Q135 88 265 118T400 102V160H0Z" fill="#131e4d" />
      {/* Laboratuvar kubbe siluetleri */}
      <circle cx="66" cy="128" r="24" fill="#1e3a8a" opacity="0.7" />
      <circle cx="336" cy="122" r="30" fill="#1e3a8a" opacity="0.65" />
    </>
  ),
};

const LAB_STOPS: AtmospherePreset[] = [
  // Durak 1: Sıcak kehribar laboratuvarı
  {
    s1: '#ffe09e',
    s2: '#ff9d5c',
    dark: false,
    sky: (
      <g>
        <circle cx="82%" cy="18%" r="44" fill="#fff7d6" opacity="0.88" />
        <circle className={s.driftSlow} cx="18%" cy="24%" r="16" fill="#fff" opacity="0.35" />
        <circle className={s.driftMed} cx="26%" cy="32%" r="9" fill="#fff" opacity="0.45" />
        <circle className={s.driftSlow} cx="72%" cy="34%" r="12" fill="#fff" opacity="0.3" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 98Q110 34 220 82T400 58V160H0Z" fill="#e89942" />
        <path d="M0 124Q145 76 275 114T400 96V160H0Z" fill="#c97926" />
      </>
    ),
  },
  // Durak 2: Akışkan biyo-kanal (okyanus mavisi)
  {
    s1: '#bae6fd',
    s2: '#5cb8f5',
    dark: false,
    sky: (
      <g>
        <g className={s.driftSlow} fill="#fff" opacity="0.65">
          <circle cx="16%" cy="22%" r="14" />
          <circle cx="22%" cy="29%" r="8" />
          <circle cx="82%" cy="20%" r="18" />
          <circle cx="75%" cy="30%" r="10" />
        </g>
        <path d="M0 52 Q120 32 240 52 T480 52" fill="none" stroke="#fff" strokeWidth="3" opacity="0.28" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 102Q115 62 235 94T400 80V160H0Z" fill="#3b9be0" />
        <path d="M0 126Q135 90 265 120T400 106V160H0Z" fill="#257ec2" />
      </>
    ),
  },
  // Durak 3: Enzim zümrüt odası
  {
    s1: '#bbf7d0',
    s2: '#4ade80',
    dark: false,
    sky: (
      <g>
        <g className={s.driftMed} fill="#fff" opacity="0.5">
          <polygon points="62,48 76,56 76,72 62,80 48,72 48,56" />
          <polygon points="310,64 328,74 328,94 310,104 292,94 292,74" />
        </g>
        <circle className={s.twinkle} cx="80%" cy="22%" r="6" fill="#fef08a" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 100Q105 56 210 92T400 76V160H0Z" fill="#2eaa60" />
        <path d="M0 124Q150 86 280 118T400 102V160H0Z" fill="#1e8a4a" />
      </>
    ),
  },
  // Durak 4: Ultra-mor kalkan odası
  {
    s1: '#241a66',
    s2: '#6344c9',
    dark: true,
    sky: (
      <g>
        <circle className={s.twinkle} cx="16%" cy="16%" r="3" fill="#fff" />
        <circle className={s.twinkle} cx="84%" cy="18%" r="4" fill="#fde047" />
        <circle cx="84%" cy="32%" r="28" fill="#a78bfa" opacity="0.28" />
        <circle className={s.driftSlow} cx="20%" cy="38%" r="16" fill="#38bdf8" opacity="0.2" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 108Q110 58 210 95T400 72V160H0Z" fill="#432f99" />
        <path d="M0 128Q140 94 270 122T400 110V160H0Z" fill="#2c1d73" />
      </>
    ),
  },
];

// --- 2. ZAMAN MAKİNESİ (time-machine) ---
const TIME_MAP: AtmospherePreset = {
  s1: '#1a103d',
  s2: '#4c1d95',
  dark: true,
  sky: (
    <g>
      <circle cx="50%" cy="30%" r="96" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="10 8" opacity="0.28" />
      <circle cx="50%" cy="30%" r="64" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="6 6" opacity="0.32" />
      <circle className={s.twinkle} cx="16%" cy="14%" r="3" fill="#fde68a" />
      <circle className={s.twinkle} cx="84%" cy="22%" r="3.5" fill="#fff" />
      <circle className={s.twinkle} cx="28%" cy="44%" r="2.5" fill="#7dd3fc" />
    </g>
  ),
  hills: (
    <>
      <path d="M0 115 L70 68 L140 115 L235 60 L330 115 L400 84 V160 H0 Z" fill="#31166b" />
      <path d="M0 132 Q150 96 290 126 T400 112 V160 H0 Z" fill="#210e4d" />
    </>
  ),
};

const TIME_STOPS: AtmospherePreset[] = [
  // Antik çağ / çöl altını
  {
    s1: '#fde68a',
    s2: '#f59e0b',
    dark: false,
    sky: <circle cx="78%" cy="20%" r="42" fill="#fffbeb" opacity="0.88" />,
    hills: (
      <>
        <path d="M0 120 L90 62 L180 120 L270 76 L355 120 L400 104 V160 H0 Z" fill="#d97706" />
        <path d="M0 132 Q140 105 280 130 T400 120 V160 H0 Z" fill="#b45309" />
      </>
    ),
  },
  // Ortaçağ / gök mavisi kuleler
  {
    s1: '#c7d2fe',
    s2: '#6366f1',
    dark: false,
    sky: (
      <g className={s.driftSlow} fill="#fff" opacity="0.65">
        <ellipse cx="22%" cy="20%" rx="44" ry="14" />
        <ellipse cx="78%" cy="24%" rx="38" ry="12" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 108 H60 V78 H82 V108 H290 V70 H315 V108 H400 V160 H0 Z" fill="#4f46e5" />
        <path d="M0 126 Q130 96 270 124 T400 112 V160 H0 Z" fill="#3730a3" />
      </>
    ),
  },
  // Sanayi / çarklar ve bakır
  {
    s1: '#fed7aa',
    s2: '#ea580c',
    dark: false,
    sky: (
      <g fill="none" stroke="#fff" strokeWidth="3" opacity="0.35">
        <circle cx="20%" cy="22%" r="24" strokeDasharray="8 6" />
        <circle cx="82%" cy="26%" r="32" strokeDasharray="10 6" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 108 Q120 68 240 98 T400 84 V160 H0 Z" fill="#c2410c" />
        <path d="M0 130 Q140 98 280 124 T400 110 V160 H0 Z" fill="#9a3412" />
      </>
    ),
  },
  // Gelecek şehri / neon uzay
  {
    s1: '#0f172a',
    s2: '#1d4ed8',
    dark: true,
    sky: (
      <g>
        <circle className={s.twinkle} cx="18%" cy="16%" r="3" fill="#38bdf8" />
        <circle className={s.twinkle} cx="80%" cy="20%" r="3.5" fill="#fde047" />
        <circle cx="76%" cy="32%" r="28" fill="#38bdf8" opacity="0.22" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 120 H42 V72 H72 V120 H148 V54 H182 V120 H280 V66 H312 V120 H400 V160 H0 Z" fill="#1e3a8a" />
        <path d="M0 134 Q150 114 300 132 T400 124 V160 H0 Z" fill="#172554" />
      </>
    ),
  },
];

// --- 3. KÂŞİF PUSULASI & DOĞA (explorer-compass) ---
const EXPLORER_MAP: AtmospherePreset = {
  s1: '#0c3b3c',
  s2: '#115e59',
  dark: true,
  sky: (
    <g>
      <circle className={s.twinkle} cx="20%" cy="16%" r="3" fill="#fef08a" />
      <circle className={s.twinkle} cx="76%" cy="20%" r="3.5" fill="#99f6e4" />
      <circle className={s.driftSlow} cx="82%" cy="34%" r="24" fill="#2dd4bf" opacity="0.2" />
    </g>
  ),
  hills: (
    <>
      <path d="M0 122 L85 52 L175 112 L275 44 L370 116 L400 96 V160 H0 Z" fill="#0f766e" />
      <path d="M0 134 Q130 98 265 126 T400 110 V160 H0 Z" fill="#134e4a" />
    </>
  ),
};

const EXPLORER_STOPS: AtmospherePreset[] = [
  {
    s1: '#d9f99d',
    s2: '#4ade80',
    dark: false,
    sky: <circle cx="80%" cy="18%" r="40" fill="#fef9c3" opacity="0.9" />,
    hills: (
      <>
        <path d="M0 115 L95 54 L185 110 L295 48 L400 105 V160 H0 Z" fill="#16a34a" />
        <path d="M0 130 Q140 94 275 122 T400 108 V160 H0 Z" fill="#15803d" />
      </>
    ),
  },
  {
    s1: '#a5f3fc',
    s2: '#06b6d4',
    dark: false,
    sky: (
      <g className={s.driftSlow} fill="#fff" opacity="0.72">
        <ellipse cx="22%" cy="18%" rx="42" ry="13" />
        <ellipse cx="78%" cy="22%" rx="46" ry="15" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 108 Q110 68 220 96 T400 84 V160 H0 Z" fill="#0891b2" />
        <path d="M0 128 Q140 96 270 122 T400 108 V160 H0 Z" fill="#0e7490" />
      </>
    ),
  },
  {
    s1: '#fde68a',
    s2: '#fb923c',
    dark: false,
    sky: <circle cx="22%" cy="20%" r="36" fill="#fff7ed" opacity="0.88" />,
    hills: (
      <>
        <path d="M0 112 L105 56 L215 112 L310 64 L400 108 V160 H0 Z" fill="#ea580c" />
        <path d="M0 132 Q145 102 280 126 T400 112 V160 H0 Z" fill="#c2410c" />
      </>
    ),
  },
  {
    s1: '#1e1b4b',
    s2: '#0f766e',
    dark: true,
    sky: (
      <g>
        <circle className={s.twinkle} cx="16%" cy="14%" r="3" fill="#fef08a" />
        <circle className={s.twinkle} cx="84%" cy="18%" r="4" fill="#5eead4" />
      </g>
    ),
    hills: (
      <>
        <path d="M0 116 L90 56 L190 110 L290 50 L400 106 V160 H0 Z" fill="#115e59" />
        <path d="M0 132 Q140 102 275 126 T400 112 V160 H0 Z" fill="#0f172a" />
      </>
    ),
  },
];

// --- 4. DEDEKTİF ATOM (detective-lens) ---
const DETECTIVE_MAP: AtmospherePreset = {
  s1: '#111827',
  s2: '#1e3a5f',
  dark: true,
  sky: (
    <g>
      <path d="M80 0 L150 320 L10 320 Z" fill="#38bdf8" opacity="0.08" />
      <path d="M320 0 L390 320 L250 320 Z" fill="#fbbf24" opacity="0.08" />
      <circle className={s.twinkle} cx="20%" cy="14%" r="3" fill="#fde047" />
      <circle className={s.twinkle} cx="80%" cy="22%" r="3" fill="#7dd3fc" />
    </g>
  ),
  hills: (
    <>
      <path d="M0 120 H48 V76 H90 V120 H140 V62 H190 V120 H250 V84 H305 V120 H345 V68 H400 V160 H0 Z" fill="#1e293b" />
      <path d="M0 134 Q150 114 300 134 T400 126 V160 H0 Z" fill="#0f172a" />
    </>
  ),
};

const DETECTIVE_STOPS: AtmospherePreset[] = [
  LAB_STOPS[0],
  LAB_STOPS[1],
  LAB_STOPS[2],
  DETECTIVE_MAP,
];

const THEME_WORLDS: Record<V2ThemeId, ThemeWorld> = {
  'lab-capsule': {
    dockLabel: 'Kapsül Parçaları',
    attachNoun: 'kapsüle',
    mapAtmosphere: LAB_MAP,
    stopAtmospheres: LAB_STOPS,
  },
  'time-machine': {
    dockLabel: 'Zaman Parçaları',
    attachNoun: 'zaman makinesine',
    mapAtmosphere: TIME_MAP,
    stopAtmospheres: TIME_STOPS,
  },
  'explorer-compass': {
    dockLabel: 'Kâşif Parçaları',
    attachNoun: 'pusulaya',
    mapAtmosphere: EXPLORER_MAP,
    stopAtmospheres: EXPLORER_STOPS,
  },
  'detective-lens': {
    dockLabel: 'Kanıt Parçaları',
    attachNoun: 'dedektif dosyasına',
    mapAtmosphere: DETECTIVE_MAP,
    stopAtmospheres: DETECTIVE_STOPS,
  },
};

export function getThemeWorld(themeId: V2ThemeId): ThemeWorld {
  return THEME_WORLDS[themeId] ?? THEME_WORLDS['lab-capsule'];
}

// Geriye dönük uyumluluk için varsayılan dışa aktarımlar
export const STOP_ATMOSPHERES = LAB_STOPS;
export const MAP_ATMOSPHERE = LAB_MAP;

export function AtmosphereBackdrop({ preset }: { preset: AtmospherePreset }) {
  return (
    <div
      className={s.bgLayer}
      style={{ background: `linear-gradient(180deg, ${preset.s1}, ${preset.s2})` }}
      aria-hidden="true"
    >
      <svg className={s.skySvg}>{preset.sky}</svg>
      {preset.mid && <svg className={s.skySvg}>{preset.mid}</svg>}
      <svg className={s.hillsSvg} viewBox="0 0 400 160" preserveAspectRatio="none">
        {preset.hills}
      </svg>
    </div>
  );
}

/** Harita panelinde ve final ödülünde parça eklendikçe güçlenen, her temaya özgü araç SVG'si. */
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
        <circle
          cx="45"
          cy="45"
          r="37"
          stroke={glow}
          strokeWidth="3"
          strokeDasharray="7 5"
          opacity={collected ? 0.92 : 0.35}
        />
        {/* Parça 4: Koruyucu enerji kalkanı */}
        {ready && <circle cx="45" cy="45" r="41" stroke="#a78bfa" strokeWidth="2.2" opacity="0.7" />}
        {/* Mikro Kapsül gövdesi */}
        <rect x="24" y="25" width="42" height="40" rx="20" fill="#e2e8f0" stroke="#1b2440" strokeWidth="3" />
        <path
          d="M45 25H46C57.0457 25 66 33.9543 66 45C66 56.0457 57.0457 65 46 65H45V25Z"
          fill="#38bdf8"
          stroke="#1b2440"
          strokeWidth="3"
        />
        {/* Gözlem penceresi */}
        <circle cx="38" cy="45" r="9" fill={glow} stroke="#1b2440" strokeWidth="2.8" />
        {collected >= 1 && <circle cx="38" cy="45" r="3.5" fill="#fff" />}
        {/* Parça 1: Yan kanatlar */}
        <path
          d="M24 38L13 33L16 45L13 57L24 52Z"
          fill={collected >= 1 ? '#ff7a29' : '#94a3b8'}
          stroke="#1b2440"
          strokeWidth="2.4"
        />
        {/* Parça 2: Üst radar anteni */}
        {collected >= 2 && (
          <g>
            <path d="M45 25V14" stroke="#1b2440" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="45" cy="12" r="4" fill="#38bdf8" stroke="#1b2440" strokeWidth="2" />
          </g>
        )}
        {/* Parça 3: Alt enzim güç hücresi */}
        {collected >= 3 && (
          <rect x="37" y="65" width="16" height="8" rx="4" fill="#22c55e" stroke="#1b2440" strokeWidth="2.2" />
        )}
        {ready && (
          <>
            <circle cx="70" cy="22" r="4" fill="#ffd166" />
            <circle cx="20" cy="69" r="3.5" fill="#22c55e" />
          </>
        )}
      </svg>
    );
  }

  if (themeId === 'time-machine') {
    return (
      <svg viewBox="0 0 90 90" fill="none" className="h-full w-full" aria-hidden="true">
        {/* Dış zaman halkaları */}
        <circle cx="45" cy="45" r="38" stroke={glow} strokeWidth="3" strokeDasharray="8 5" opacity={collected ? 0.95 : 0.35} />
        <circle cx="45" cy="45" r="28" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="3.5" />
        <circle cx="45" cy="45" r="20" fill="#312e81" stroke="#38bdf8" strokeWidth="2.2" />
        {/* Saat ibreleri */}
        <path d="M45 45V31" stroke="#fde047" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M45 45L56 50" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="45" cy="45" r="4.5" fill="#f97316" stroke="#fff" strokeWidth="1.8" />
        {/* 4 yön zaman kristalleri */}
        {collected >= 1 && <circle cx="45" cy="11" r="4.5" fill="#f59e0b" stroke="#1b2440" strokeWidth="2" />}
        {collected >= 2 && <circle cx="79" cy="45" r="4.5" fill="#38bdf8" stroke="#1b2440" strokeWidth="2" />}
        {collected >= 3 && <circle cx="45" cy="79" r="4.5" fill="#22c55e" stroke="#1b2440" strokeWidth="2" />}
        {ready && <circle cx="11" cy="45" r="4.5" fill="#a78bfa" stroke="#1b2440" strokeWidth="2" />}
      </svg>
    );
  }

  if (themeId === 'explorer-compass') {
    return (
      <svg viewBox="0 0 90 90" fill="none" className="h-full w-full" aria-hidden="true">
        <circle cx="45" cy="47" r="35" fill="#f59e0b" stroke="#1b2440" strokeWidth="3" />
        <circle cx="45" cy="47" r="27" fill="#fef3c7" stroke="#1b2440" strokeWidth="2.6" />
        {/* Üst halka */}
        <circle cx="45" cy="10" r="5" fill="#fde047" stroke="#1b2440" strokeWidth="2.4" />
        {/* Pusula ibresi */}
        <path d="M45 25L53 47L45 69L37 47L45 25Z" fill="#ef4444" stroke="#1b2440" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M45 47L53 47L45 69L37 47Z" fill="#0ea5e9" stroke="#1b2440" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="45" cy="47" r="4.5" fill="#fff" stroke="#1b2440" strokeWidth="2.2" />
        {ready && <circle cx="45" cy="47" r="39" stroke="#34d399" strokeWidth="2.5" strokeDasharray="6 5" />}
      </svg>
    );
  }

  // detective-lens
  return (
    <svg viewBox="0 0 90 90" fill="none" className="h-full w-full" aria-hidden="true">
      <circle cx="42" cy="40" r="34" stroke={glow} strokeWidth="2.8" strokeDasharray="6 5" opacity={collected ? 0.9 : 0.35} />
      {/* Sap */}
      <path d="M60 58L77 75" stroke="#1b2440" strokeWidth="11" strokeLinecap="round" />
      <path d="M60 58L77 75" stroke="#f97316" strokeWidth="6" strokeLinecap="round" />
      {/* Mercek çerçevesi */}
      <circle cx="42" cy="40" r="24" fill="#0f172a" stroke="#1b2440" strokeWidth="3.5" />
      <circle cx="42" cy="40" r="18" fill="#bae6fd" stroke="#38bdf8" strokeWidth="2.5" />
      {/* Tarama çizgisi ve parıltı */}
      <path d="M31 33A14 14 0 0 1 43 26" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="40" r="7" stroke="#0284c7" strokeWidth="2" strokeDasharray="3 3" opacity={collected >= 1 ? 0.9 : 0.3} />
      {ready && <circle cx="42" cy="40" r="4" fill="#22c55e" />}
    </svg>
  );
}
