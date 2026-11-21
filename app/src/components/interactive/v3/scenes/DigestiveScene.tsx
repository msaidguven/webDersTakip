'use client';

// Canlı, etkileşimli Sindirim Sistemi Vektör/SVG Sahnesi (Konu #861).
// Her tek-bilgi adımına göre ilgili organı, besin lokmasını, villus yakınlaştırmasını,
// yardımcı organ salgı kanallarını veya sindirim sağlığı şemasını net ve yüksek kontrastlı çizer.
import { useId } from 'react';
import type { DigestiveFocusId } from '@/app/src/lib/interactiveLesson/typesV3';
import s from '../v3.module.css';

const ANATOMY_FOCUSES = new Set<DigestiveFocusId>([
  'mouth',
  'pharynx',
  'esophagus',
  'stomach',
  'small-intestine',
  'villus-zoom',
  'large-intestine',
  'anus',
  'accessory-overview',
  'liver-gallbladder',
  'bile-physical',
  'pancreas-overview',
  'pancreas-chemical',
]);

const BOLUS_POS: Partial<Record<DigestiveFocusId, { cx: number; cy: number }>> = {
  mouth: { cx: 292, cy: 108 },
  pharynx: { cx: 274, cy: 138 },
  esophagus: { cx: 274, cy: 205 },
  stomach: { cx: 300, cy: 294 },
  'small-intestine': { cx: 280, cy: 382 },
  'villus-zoom': { cx: 280, cy: 382 },
  'large-intestine': { cx: 224, cy: 368 },
  anus: { cx: 274, cy: 454 },
};

function ConceptStageSvg({ focus }: { focus: DigestiveFocusId }) {
  if (focus === 'overview-digestion') {
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Sindirim: büyük besinlerin kana geçebilecek küçük parçalara ayrılması">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0F172A">
          Besinlerin Kana Geçiş Yolculuğu
        </text>
        {/* Büyük besin */}
        <g transform="translate(62 128)">
          <rect x="0" y="0" width="136" height="136" rx="24" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="3" />
          <circle cx="48" cy="52" r="22" fill="#F59E0B" />
          <circle cx="88" cy="52" r="22" fill="#D97706" />
          <circle cx="68" cy="88" r="22" fill="#FBBF24" />
          <text x="68" y="164" textAnchor="middle" fontSize="15" fontWeight="800" fill="#92400E">Büyük Besin</text>
          <text x="68" y="184" textAnchor="middle" fontSize="13" fontWeight="600" fill="#64748B">Kana geçemez</text>
        </g>
        {/* Ok 1 */}
        <path d="M214 196 H262" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" className={s.svgFlow} />
        <polygon points="262,188 278,196 262,204" fill="#0284C7" />
        {/* Sindirim süreci */}
        <g transform="translate(284 128)">
          <rect x="0" y="0" width="136" height="136" rx="24" fill="#E0F2FE" stroke="#0284C7" strokeWidth="3" />
          <circle cx="42" cy="54" r="10" fill="#0284C7" className={s.svgFloat} />
          <circle cx="94" cy="48" r="9" fill="#0EA5E9" className={s.svgFloat} />
          <circle cx="68" cy="88" r="10" fill="#10B981" className={s.svgFloat} />
          <circle cx="38" cy="96" r="8" fill="#F59E0B" className={s.svgFloat} />
          <circle cx="98" cy="92" r="9" fill="#0284C7" className={s.svgFloat} />
          <text x="68" y="164" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0369A1">Sindirim</text>
          <text x="68" y="184" textAnchor="middle" fontSize="13" fontWeight="600" fill="#64748B">Küçük parçalara ayrılır</text>
        </g>
        {/* Ok 2 */}
        <path d="M434 196 H472" stroke="#059669" strokeWidth="5" strokeLinecap="round" className={s.svgFlow} />
        <polygon points="472,188 488,196 472,204" fill="#059669" />
        {/* Kan damarı */}
        <g transform="translate(494 128)">
          <rect x="0" y="18" width="96" height="100" rx="22" fill="#FFE4E6" stroke="#E11D48" strokeWidth="3" />
          <circle cx="30" cy="52" r="6" fill="#0284C7" />
          <circle cx="64" cy="64" r="6" fill="#10B981" />
          <circle cx="44" cy="88" r="6" fill="#F59E0B" />
          <text x="48" y="164" textAnchor="middle" fontSize="15" fontWeight="800" fill="#BE123C">Kan Damarı</text>
          <text x="48" y="184" textAnchor="middle" fontSize="13" fontWeight="600" fill="#64748B">Hücrelere taşınır</text>
        </g>
      </svg>
    );
  }

  if (focus === 'physical-chewing') {
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Fiziksel sindirim: kimyasal yapı değişmeden parçalanma">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0F172A">
          Fiziksel (Mekanik) Sindirim
        </text>
        {/* Büyük küp */}
        <rect x="78" y="128" width="128" height="128" rx="18" fill="#F59E0B" stroke="#B45309" strokeWidth="3" />
        <text x="142" y="198" textAnchor="middle" fontSize="17" fontWeight="800" fill="#FFFFFF">Bütün Lokma</text>
        <text x="142" y="284" textAnchor="middle" fontSize="14" fontWeight="700" fill="#92400E">Çiğneme &amp; Kas Hareketi</text>
        {/* Ok */}
        <path d="M236 192 H346" stroke="#D97706" strokeWidth="5" strokeLinecap="round" className={s.svgFlow} />
        <polygon points="346,184 364,192 346,200" fill="#D97706" />
        <rect x="242" y="142" width="106" height="32" rx="16" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2" />
        <text x="295" y="163" textAnchor="middle" fontSize="13" fontWeight="800" fill="#B45309">Enzim YOK</text>
        {/* Küçük parçalar */}
        <g transform="translate(390 120)">
          {[
            [12, 12], [78, 12], [144, 12],
            [12, 78], [78, 78], [144, 78],
          ].map(([x, y], idx) => (
            <rect
              key={idx}
              x={x}
              y={y}
              width="52"
              height="52"
              rx="12"
              fill="#FBBF24"
              stroke="#B45309"
              strokeWidth="2.5"
              className={s.svgFloat}
            />
          ))}
        </g>
        <text x="494" y="284" textAnchor="middle" fontSize="14" fontWeight="700" fill="#92400E">Aynı Yapı, Küçük Parçalar</text>
        <rect x="130" y="318" width="380" height="36" rx="18" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
        <text x="320" y="341" textAnchor="middle" fontSize="14" fontWeight="800" fill="#92400E">
          Kimyasal yapı değişmez — yalnızca boyut küçülür!
        </text>
      </svg>
    );
  }

  if (focus === 'surface-area') {
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Temas yüzey alanının artması">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0F172A">
          Temas Yüzey Alanı Neden Önemli?
        </text>
        {/* Sol: Bütün küp şeker */}
        <g transform="translate(64 100)">
          <rect x="0" y="0" width="210" height="220" rx="20" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
          <rect x="55" y="42" width="100" height="100" rx="14" fill="#FDE68A" stroke="#D97706" strokeWidth="3" />
          <text x="105" y="98" textAnchor="middle" fontSize="15" fontWeight="800" fill="#92400E">Bütün Küp</text>
          <text x="105" y="176" textAnchor="middle" fontSize="14" fontWeight="800" fill="#475569">Dar Temas Yüzeyi</text>
          <text x="105" y="198" textAnchor="middle" fontSize="13" fontWeight="600" fill="#64748B">Yavaş çözünür</text>
        </g>
        {/* Sağ: Parçalanmış küpler */}
        <g transform="translate(366 100)">
          <rect x="0" y="0" width="210" height="220" rx="20" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="2.5" />
          {[
            [42, 34], [116, 34],
            [42, 98], [116, 98],
          ].map(([x, y], i) => (
            <g key={i} className={s.svgFloat}>
              <rect x={x} y={y} width="52" height="52" rx="10" fill="#FBBF24" stroke="#0284C7" strokeWidth="2.5" />
            </g>
          ))}
          <text x="105" y="176" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0369A1">Geniş Temas Yüzeyi</text>
          <text x="105" y="198" textAnchor="middle" fontSize="13" fontWeight="700" fill="#059669">Enzimler çok hızlı etki eder!</text>
        </g>
        <path d="M286 210 H344" stroke="#0284C7" strokeWidth="5" strokeLinecap="round" className={s.svgFlow} />
        <polygon points="344,202 360,210 344,218" fill="#0284C7" />
      </svg>
    );
  }

  if (focus === 'chemical-breakdown' || focus === 'enzyme-speed') {
    const isEnzyme = focus === 'enzyme-speed';
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Kimyasal sindirim ve enzimlerin görevi">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0F172A">
          {isEnzyme ? 'Enzimler Kimyasal Sindirimi Hızlandırır' : 'Kimyasal Sindirim: Yapı Taşlarına Ayrışma'}
        </text>
        {/* Molekül zinciri */}
        <g transform="translate(64 150)">
          <line x1="30" y1="40" x2="170" y2="40" stroke="#059669" strokeWidth="6" />
          {[30, 76, 122, 168].map((cx) => (
            <circle key={cx} cx={cx} cy="40" r="18" fill="#10B981" stroke="#047857" strokeWidth="3" />
          ))}
          <text x="100" y="96" textAnchor="middle" fontSize="14" fontWeight="800" fill="#065F46">Karmaşık Molekül</text>
        </g>
        {/* Su + Enzim rozeti */}
        <g transform="translate(274 118)">
          <rect x="0" y="0" width="112" height="104" rx="20" fill="#FFFFFF" stroke="#0284C7" strokeWidth="3" className={s.svgPulse} />
          <text x="56" y="44" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0284C7">SU +</text>
          <text x="56" y="72" textAnchor="middle" fontSize="18" fontWeight="900" fill="#059669">ENZİM</text>
        </g>
        {/* Ayrılmış yapı taşları */}
        <g transform="translate(430 132)">
          {[
            [24, 24], [86, 18], [52, 74], [116, 68],
          ].map(([cx, cy], idx) => (
            <circle key={idx} cx={cx} cy={cy} r="16" fill="#34D399" stroke="#047857" strokeWidth="2.5" className={s.svgFloat} />
          ))}
          <text x="72" y="120" textAnchor="middle" fontSize="14" fontWeight="800" fill="#065F46">Yapı Taşları</text>
          <text x="72" y="140" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="#475569">Hücre zarından geçer</text>
        </g>
        <rect x="108" y="314" width="424" height="38" rx="19" fill="#FFFFFF" stroke="#6EE7B7" strokeWidth="2" />
        <text x="320" y="338" textAnchor="middle" fontSize="14" fontWeight="800" fill="#047857">
          {isEnzyme
            ? 'Enzimler yalnızca kimyasal sindirimde kullanılır!'
            : 'Su ve enzimlerle besinler en küçük yapı taşlarına ayrılır.'}
        </text>
      </svg>
    );
  }

  // Bölüm 4 — Sindirim Sağlığı sahneleri
  if (focus === 'health-balanced') {
    const groups = [
      { label: 'Karbonhidrat', x: 140, y: 140, color: '#F59E0B', bg: '#FEF3C7' },
      { label: 'Protein', x: 320, y: 120, color: '#E11D48', bg: '#FFE4E6' },
      { label: 'Yağ', x: 500, y: 140, color: '#D97706', bg: '#FFEDD5' },
      { label: 'Vitamin', x: 140, y: 268, color: '#10B981', bg: '#D1FAE5' },
      { label: 'Mineral', x: 320, y: 288, color: '#6366F1', bg: '#E0E7FF' },
      { label: 'Su', x: 500, y: 268, color: '#0284C7', bg: '#E0F2FE' },
    ];
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="6 besin grubu ile dengeli beslenme">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0F172A">
          6 Besin Grubu ile Dengeli Beslenme
        </text>
        <circle cx="320" cy="204" r="46" fill="#FFFFFF" stroke="#10B981" strokeWidth="3" className={s.svgPulse} />
        <text x="320" y="200" textAnchor="middle" fontSize="14" fontWeight="800" fill="#047857">Dengeli</text>
        <text x="320" y="218" textAnchor="middle" fontSize="14" fontWeight="800" fill="#047857">Öğün</text>
        {groups.map((g) => (
          <g key={g.label}>
            <line x1="320" y1="204" x2={g.x} y2={g.y} stroke={g.color} strokeWidth="2.5" strokeDasharray="5 5" opacity="0.55" />
            <rect x={g.x - 68} y={g.y - 24} width="136" height="48" rx="24" fill={g.bg} stroke={g.color} strokeWidth="2.5" />
            <text x={g.x} y={g.y + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0F172A">{g.label}</text>
          </g>
        ))}
      </svg>
    );
  }

  if (focus === 'health-chewing') {
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Yavaş ve iyi çiğneme mide yükünü azaltır">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0F172A">
          Oturarak, Yavaş ve İyi Çiğneme
        </text>
        <g transform="translate(70 116)">
          <rect x="0" y="0" width="210" height="196" rx="20" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2.5" />
          <text x="105" y="42" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0369A1">Ağızda İyi Çiğneme</text>
          <circle cx="72" cy="96" r="14" fill="#FBBF24" />
          <circle cx="106" cy="86" r="12" fill="#F59E0B" />
          <circle cx="136" cy="102" r="13" fill="#FBBF24" />
          <circle cx="96" cy="126" r="11" fill="#F59E0B" />
          <text x="105" y="168" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#475569">Fiziksel sindirim artar</text>
        </g>
        <path d="M294 214 H348" stroke="#10B981" strokeWidth="5" strokeLinecap="round" className={s.svgFlow} />
        <polygon points="348,206 364,214 348,222" fill="#10B981" />
        <g transform="translate(370 116)">
          <rect x="0" y="0" width="200" height="196" rx="20" fill="#ECFDF5" stroke="#10B981" strokeWidth="2.5" />
          <text x="100" y="42" textAnchor="middle" fontSize="16" fontWeight="800" fill="#047857">Rahat Mide</text>
          <path d="M74 78 C58 92 60 132 94 136 C128 140 144 114 132 88 C124 72 94 64 74 78 Z" fill="#6EE7B7" stroke="#059669" strokeWidth="3" />
          <text x="100" y="168" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="#065F46">İş yükü azalır!</text>
        </g>
      </svg>
    );
  }

  if (focus === 'health-risks') {
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Zararlı gıdalar ve sindirim rahatsızlıkları">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#FFF1F2" stroke="#FECDD3" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#881337">
          Zararlı Gıdalar &amp; Sindirim Riskleri
        </text>
        <g transform="translate(60 108)">
          <rect x="0" y="0" width="228" height="214" rx="20" fill="#FFFFFF" stroke="#FDA4AF" strokeWidth="2.5" />
          <text x="114" y="38" textAnchor="middle" fontSize="15.5" fontWeight="800" fill="#BE123C">Kaçınılması Gerekenler</text>
          {['Aşırı yağlı yiyecekler', 'Fazla baharatlı gıdalar', 'Paketli & hazır gıdalar', 'Ayaküstü fast-food'].map((t, i) => (
            <g key={t} transform={`translate(18 ${62 + i * 36})`}>
              <circle cx="8" cy="10" r="5" fill="#E11D48" />
              <text x="22" y="15" fontSize="14" fontWeight="700" fill="#334155">{t}</text>
            </g>
          ))}
        </g>
        <path d="M300 214 H348" stroke="#E11D48" strokeWidth="5" strokeLinecap="round" className={s.svgFlow} />
        <polygon points="348,206 364,214 348,222" fill="#E11D48" />
        <g transform="translate(372 108)">
          <rect x="0" y="0" width="208" height="214" rx="20" fill="#FFE4E6" stroke="#E11D48" strokeWidth="2.5" />
          <text x="104" y="38" textAnchor="middle" fontSize="15.5" fontWeight="800" fill="#881337">Olası Rahatsızlıklar</text>
          {['Reflü', 'Gastrit', 'Obezite'].map((r, i) => (
            <g key={r} transform={`translate(24 ${64 + i * 48})`}>
              <rect x="0" y="0" width="160" height="36" rx="12" fill="#FFFFFF" stroke="#FB7185" strokeWidth="2" />
              <text x="80" y="23" textAnchor="middle" fontSize="15" fontWeight="800" fill="#BE123C">{r}</text>
            </g>
          ))}
        </g>
      </svg>
    );
  }

  if (focus === 'health-exercise') {
    return (
      <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Düzenli egzersizin sindirime faydaları">
        <rect x="20" y="24" width="600" height="352" rx="24" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="2" />
        <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#065F46">
          Düzenli Egzersizin 3 Büyük Faydası
        </text>
        {[
          { x: 54, title: 'Bağırsak Hareketi', sub: 'Bağırsak kaslarını uyarır', color: '#059669' },
          { x: 234, title: 'Kan Akışı & Hız', sub: 'Metabolizmayı hızlandırır', color: '#0284C7' },
          { x: 414, title: 'Daha Az Stres', sub: 'Sindirim organlarını korur', color: '#D97706' },
        ].map((card, i) => (
          <g key={card.title} transform={`translate(${card.x} 118)`}>
            <rect x="0" y="0" width="172" height="194" rx="22" fill="#FFFFFF" stroke={card.color} strokeWidth="2.5" />
            <circle cx="86" cy="58" r="28" fill={card.color} opacity="0.14" className={s.svgPulse} />
            <text x="86" y="65" textAnchor="middle" fontSize="22" fontWeight="900" fill={card.color}>{i + 1}</text>
            <text x="86" y="122" textAnchor="middle" fontSize="15.5" fontWeight="800" fill="#0F172A">{card.title}</text>
            <text x="86" y="150" textAnchor="middle" fontSize="13" fontWeight="600" fill="#475569">{card.sub}</text>
          </g>
        ))}
      </svg>
    );
  }

  // health-screen
  return (
    <svg viewBox="0 0 640 400" className={s.sceneSvg} role="img" aria-label="Teknoloji bağımlılığının sindirime olumsuz etkileri">
      <rect x="20" y="24" width="600" height="352" rx="24" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="2" />
      <text x="320" y="64" textAnchor="middle" fontSize="20" fontWeight="800" fill="#92400E">
        Ekran Bağımlılığı Sindirimi Nasıl Etkiler?
      </text>
      {[
        { y: 102, title: '1. Uzun Süre Hareketsizlik', desc: 'Bağırsak hareketlerinin yavaşlamasına yol açar.' },
        { y: 186, title: '2. Öne Eğilerek Oturmak', desc: 'Mide ve bağırsaklar üzerinde fiziksel baskı oluşturur.' },
        { y: 270, title: '3. Dikkat Dağınıklığı', desc: 'Tokluk hissi fark edilmez; hızlı/aşırı yeme veya öğün atlama olur.' },
      ].map((row) => (
        <g key={row.title} transform={`translate(70 ${row.y})`}>
          <rect x="0" y="0" width="500" height="68" rx="16" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="2" />
          <text x="22" y="28" fontSize="15.5" fontWeight="800" fill="#B45309">{row.title}</text>
          <text x="22" y="51" fontSize="13.5" fontWeight="600" fill="#334155">{row.desc}</text>
        </g>
      ))}
    </svg>
  );
}

export function DigestiveScene({ focus }: { focus: DigestiveFocusId }) {
  const uid = useId().replace(/:/g, '');
  if (!ANATOMY_FOCUSES.has(focus)) {
    return <ConceptStageSvg focus={focus} />;
  }

  const torsoGradId = `${uid}-torsoGrad`;
  const organGlowId = `${uid}-organGlow`;
  const warmGlowId = `${uid}-warmGlow`;
  const villusClipId = `${uid}-villusClip`;

  const isMouth = focus === 'mouth';
  const isPharynx = focus === 'pharynx';
  const isEsophagus = focus === 'esophagus';
  const isStomach = focus === 'stomach';
  const isSmall = focus === 'small-intestine' || focus === 'villus-zoom';
  const isVillus = focus === 'villus-zoom';
  const isLarge = focus === 'large-intestine';
  const isAnus = focus === 'anus';
  const isLiver = focus === 'accessory-overview' || focus === 'liver-gallbladder' || focus === 'bile-physical';
  const isPancreas = focus === 'accessory-overview' || focus === 'pancreas-overview' || focus === 'pancreas-chemical';
  const bolus = BOLUS_POS[focus];

  return (
    <svg
      viewBox="0 0 640 500"
      className={s.sceneSvg}
      role="img"
      aria-label="İnsan sindirim sistemi etkileşimli şeması"
    >
      <defs>
        <linearGradient id={torsoGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E4EEF9" />
          <stop offset="100%" stopColor="#D3E2F4" />
        </linearGradient>
        <filter id={organGlowId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#0284C7" floodOpacity="0.45" />
        </filter>
        <filter id={warmGlowId} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#F59E0B" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* İnsan Gövde Silueti */}
      <path
        d="M274 26 C242 26 226 48 228 80 C228 102 238 118 248 128 L244 152 C202 158 172 184 166 232 L152 342 L182 346 L194 252 L198 468 L350 468 L354 252 L366 346 L396 342 L382 232 C376 184 346 158 304 152 L300 128 C312 118 320 100 320 80 C322 48 306 26 274 26 Z"
        fill={`url(#${torsoGradId})`}
        stroke="#A7C0DF"
        strokeWidth="2.5"
      />

      {/* Ağız Boşluğu */}
      <path
        d="M278 98 C298 94 316 98 318 108 C316 118 296 122 276 118 Z"
        fill={isMouth ? '#F59E0B' : '#F4B2A6'}
        stroke={isMouth ? '#B45309' : '#C97B6E'}
        strokeWidth={isMouth ? 3.5 : 2}
        filter={isMouth ? `url(#${warmGlowId})` : undefined}
      />

      {/* Yutak */}
      <path
        d="M268 114 C274 114 282 116 282 128 L280 150 L268 150 L268 128 Z"
        fill={isPharynx ? '#0284C7' : '#E9A59B'}
        stroke={isPharynx ? '#0369A1' : '#C4776D'}
        strokeWidth={isPharynx ? 3.5 : 2}
        filter={isPharynx ? `url(#${organGlowId})` : undefined}
      />

      {/* Yemek Borusu */}
      <path
        d="M269 150 L279 150 L282 256 L270 256 Z"
        fill={isEsophagus ? '#0284C7' : '#E7A99F'}
        stroke={isEsophagus ? '#0369A1' : '#C4776D'}
        strokeWidth={isEsophagus ? 3.5 : 2}
        filter={isEsophagus ? `url(#${organGlowId})` : undefined}
      />

      {/* Karaciğer + Safra Kesesi (Sol üstte görünür: anatomik sağ) */}
      <g filter={isLiver ? `url(#${organGlowId})` : undefined}>
        <path
          d="M214 242 C214 218 248 214 274 226 C284 231 286 244 274 252 C256 264 228 274 218 270 C212 266 212 254 214 242 Z"
          fill={isLiver ? '#10B981' : '#B9645A'}
          stroke={isLiver ? '#047857' : '#8F463E'}
          strokeWidth={isLiver ? 3.5 : 2}
        />
        {/* Safra kesesi */}
        <ellipse
          cx="248"
          cy="272"
          rx="11"
          ry="7"
          fill={isLiver ? '#34D399' : '#65A30D'}
          stroke={isLiver ? '#065F46' : '#3F6212'}
          strokeWidth="2"
        />
        {/* Safra kanalı -> ince bağırsak */}
        {isLiver && (
          <path
            d="M254 278 Q266 306 276 326"
            fill="none"
            stroke="#059669"
            strokeWidth="4.5"
            strokeLinecap="round"
            className={s.svgFlow}
          />
        )}
      </g>

      {/* Pankreas (Midenin arka alt kısmında) */}
      <g filter={isPancreas ? `url(#${organGlowId})` : undefined}>
        <path
          d="M268 318 C288 310 318 310 330 318 C334 324 326 332 308 332 C292 332 276 330 266 326 Z"
          fill={isPancreas ? '#0EA5E9' : '#F3C669'}
          stroke={isPancreas ? '#0369A1' : '#C69535'}
          strokeWidth={isPancreas ? 3.5 : 2}
        />
        {isPancreas && (
          <path
            d="M276 326 Q274 338 276 348"
            fill="none"
            stroke="#0284C7"
            strokeWidth="4.5"
            strokeLinecap="round"
            className={s.svgFlow}
          />
        )}
      </g>

      {/* Mide (J şekilli) */}
      <path
        d="M276 254 C296 248 330 262 330 290 C330 314 304 324 282 318 C268 314 266 296 274 284 C278 276 272 264 276 254 Z"
        fill={isStomach ? '#F97316' : '#EE9681'}
        stroke={isStomach ? '#C2410C' : '#C26C59'}
        strokeWidth={isStomach ? 3.5 : 2}
        filter={isStomach ? `url(#${warmGlowId})` : undefined}
      />

      {/* Kalın Bağırsak (Çerçeve) */}
      <path
        d="M222 414 L222 350 C222 336 234 330 248 330 L306 330 C320 330 330 338 330 352 L330 412 C330 424 316 428 294 428 L278 428 L278 448"
        fill="none"
        stroke={isLarge ? '#10B981' : '#C98A7A'}
        strokeWidth={isLarge ? 20 : 17}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={isLarge ? `url(#${organGlowId})` : undefined}
      />
      <path
        d="M222 414 L222 350 C222 336 234 330 248 330 L306 330 C320 330 330 338 330 352 L330 412 C330 424 316 428 294 428 L278 428 L278 448"
        fill="none"
        stroke={isLarge ? '#A7F3D0' : '#E5B2A5'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="6 10"
      />

      {/* İnce Bağırsak (Kıvrımlı orta bölüm) */}
      <path
        d="M244 352 C264 344 294 344 306 354 C316 364 242 368 244 378 C246 388 312 388 308 398 C304 408 246 406 250 414 C254 420 290 418 296 414"
        fill="none"
        stroke={isSmall ? '#0284C7' : '#E6A15C'}
        strokeWidth={isSmall ? 14 : 12}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={isSmall ? `url(#${organGlowId})` : undefined}
      />

      {/* Anüs */}
      <circle
        cx="278"
        cy="454"
        r={isAnus ? 11 : 7}
        fill={isAnus ? '#7C3AED' : '#94A3B8'}
        stroke={isAnus ? '#4C1D95' : '#64748B'}
        strokeWidth="2.5"
        filter={isAnus ? `url(#${organGlowId})` : undefined}
      />

      {/* Hareketli Besin Lokması */}
      {bolus && (
        <g className={s.svgPulse}>
          <circle cx={bolus.cx} cy={bolus.cy} r="13" fill="#F59E0B" opacity="0.28" />
          <circle cx={bolus.cx} cy={bolus.cy} r="7.5" fill="#FBBF24" stroke="#B45309" strokeWidth="2.5" />
        </g>
      )}

      {/* Villus Yakınlaştırma Merceği (İnce Bağırsak / Villus odağında) */}
      {isVillus && (
        <g>
          <line x1="306" y1="384" x2="430" y2="334" stroke="#0284C7" strokeWidth="2.5" strokeDasharray="5 4" />
          <circle cx="508" cy="316" r="88" fill="#FFFFFF" stroke="#0284C7" strokeWidth="4" />
          <clipPath id={villusClipId}>
            <circle cx="508" cy="316" r="84" />
          </clipPath>
          <g clipPath={`url(#${villusClipId})`}>
            <rect x="420" y="228" width="176" height="176" fill="#E0F2FE" />
            {/* Parmak benzeri villus kıvrımları */}
            <path
              d="M424 388 L434 388 C438 388 438 292 454 292 C470 292 470 368 482 368 C494 368 494 276 510 276 C526 276 526 368 538 368 C550 368 550 294 566 294 C582 294 582 388 594 388 L594 408 L424 408 Z"
              fill="#FDBA74"
              stroke="#EA580C"
              strokeWidth="3"
            />
            {/* Kılcal damarlar */}
            <path d="M454 388 V312 M510 388 V296 M566 388 V314" stroke="#E11D48" strokeWidth="3.5" strokeLinecap="round" />
            {/* Besin emilim okları */}
            <circle cx="454" cy="272" r="5" fill="#0284C7" className={s.svgFloat} />
            <circle cx="510" cy="256" r="5" fill="#10B981" className={s.svgFloat} />
            <circle cx="566" cy="274" r="5" fill="#F59E0B" className={s.svgFloat} />
          </g>
          <rect x="434" y="412" width="148" height="32" rx="16" fill="#0284C7" />
          <text x="508" y="433" textAnchor="middle" fontSize="13.5" fontWeight="800" fill="#FFFFFF">
            Villus Kıvrımları
          </text>
        </g>
      )}

      {/* Safra Yağ Damlacığı Yakınlaştırması */}
      {focus === 'bile-physical' && (
        <g>
          <rect x="406" y="138" width="212" height="176" rx="22" fill="#ECFDF5" stroke="#10B981" strokeWidth="2.5" />
          <text x="512" y="168" textAnchor="middle" fontSize="14.5" fontWeight="800" fill="#065F46">
            Safra: Yağlara Fiziksel
          </text>
          <circle cx="454" cy="222" r="24" fill="#FBBF24" stroke="#B45309" strokeWidth="2.5" />
          <path d="M486 222 H518" stroke="#059669" strokeWidth="4" className={s.svgFlow} />
          <circle cx="546" cy="204" r="9" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          <circle cx="574" cy="212" r="8" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          <circle cx="548" cy="236" r="8" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          <circle cx="574" cy="240" r="9" fill="#FBBF24" stroke="#B45309" strokeWidth="2" />
          <rect x="430" y="270" width="164" height="28" rx="14" fill="#FFFFFF" stroke="#6EE7B7" strokeWidth="1.5" />
          <text x="512" y="289" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#047857">
            Enzim İçermez!
          </text>
        </g>
      )}

      {/* Pankreas Öz Suyu Yakınlaştırması */}
      {focus === 'pancreas-chemical' && (
        <g>
          <rect x="406" y="138" width="212" height="176" rx="22" fill="#F0F9FF" stroke="#0284C7" strokeWidth="2.5" />
          <text x="512" y="168" textAnchor="middle" fontSize="14.5" fontWeight="800" fill="#0369A1">
            Pankreas Öz Suyu
          </text>
          {['Karbonhidrat → Kimyasal', 'Protein → Kimyasal', 'Yağ → Kimyasal'].map((row, idx) => (
            <g key={row} transform={`translate(422 ${186 + idx * 38})`}>
              <rect x="0" y="0" width="180" height="30" rx="10" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="1.5" />
              <text x="90" y="20" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#0F172A">{row}</text>
            </g>
          ))}
        </g>
      )}

      {/* Temiz Organ Etiketleri (Aktif odağa göre öne çıkanlar) */}
      <g fontSize="13.5" fontWeight="800">
        {/* Ağız */}
        <line x1="318" y1="108" x2="394" y2="92" stroke={isMouth ? '#D97706' : '#94A3B8'} strokeWidth={isMouth ? 2.5 : 1.5} />
        <rect x="394" y="74" width="116" height="34" rx="17" fill={isMouth ? '#FEF3C7' : '#FFFFFF'} stroke={isMouth ? '#D97706' : '#CBD5E1'} strokeWidth={isMouth ? 2.5 : 1.5} />
        <text x="452" y="96" textAnchor="middle" fill={isMouth ? '#92400E' : '#334155'}>Ağız</text>

        {/* Yutak & Yemek Borusu */}
        {(isPharynx || isEsophagus) && (
          <>
            <line x1="268" y1={isPharynx ? 136 : 204} x2="174" y2={isPharynx ? 136 : 204} stroke="#0284C7" strokeWidth="2.5" />
            <rect x="28" y={isPharynx ? 118 : 186} width="146" height="36" rx="18" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2.5" />
            <text x="101" y={isPharynx ? 141 : 209} textAnchor="middle" fill="#0369A1">
              {isPharynx ? 'Yutak (Sindirim yok)' : 'Yemek Borusu'}
            </text>
          </>
        )}

        {/* Karaciğer */}
        <line x1="214" y1="248" x2="164" y2="248" stroke={isLiver ? '#059669' : '#94A3B8'} strokeWidth={isLiver ? 2.5 : 1.5} />
        <rect x="36" y="230" width="128" height="34" rx="17" fill={isLiver ? '#D1FAE5' : '#FFFFFF'} stroke={isLiver ? '#059669' : '#CBD5E1'} strokeWidth={isLiver ? 2.5 : 1.5} />
        <text x="100" y="252" textAnchor="middle" fill={isLiver ? '#065F46' : '#334155'}>Karaciğer</text>

        {/* Mide */}
        {!focus.startsWith('bile') && !focus.startsWith('pancreas-chemical') && (
          <>
            <line x1="330" y1="286" x2="394" y2="262" stroke={isStomach ? '#EA580C' : '#94A3B8'} strokeWidth={isStomach ? 2.5 : 1.5} />
            <rect x="394" y="244" width="116" height="34" rx="17" fill={isStomach ? '#FFEDD5' : '#FFFFFF'} stroke={isStomach ? '#EA580C' : '#CBD5E1'} strokeWidth={isStomach ? 2.5 : 1.5} />
            <text x="452" y="266" textAnchor="middle" fill={isStomach ? '#9A3412' : '#334155'}>Mide</text>
          </>
        )}

        {/* Pankreas */}
        {isPancreas && (
          <>
            <line x1="322" y1="324" x2="394" y2="352" stroke="#0284C7" strokeWidth="2.5" />
            <rect x="394" y="334" width="132" height="34" rx="17" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2.5" />
            <text x="460" y="356" textAnchor="middle" fill="#0369A1">Pankreas</text>
          </>
        )}

        {/* İnce Bağırsak */}
        {!isVillus && !isPancreas && (
          <>
            <line x1="310" y1="382" x2="394" y2="382" stroke={isSmall ? '#0284C7' : '#94A3B8'} strokeWidth={isSmall ? 2.5 : 1.5} />
            <rect x="394" y="364" width="140" height="34" rx="17" fill={isSmall ? '#E0F2FE' : '#FFFFFF'} stroke={isSmall ? '#0284C7' : '#CBD5E1'} strokeWidth={isSmall ? 2.5 : 1.5} />
            <text x="464" y="386" textAnchor="middle" fill={isSmall ? '#0369A1' : '#334155'}>İnce Bağırsak</text>
          </>
        )}

        {/* Kalın Bağırsak */}
        <line x1="214" y1="382" x2="164" y2="382" stroke={isLarge ? '#059669' : '#94A3B8'} strokeWidth={isLarge ? 2.5 : 1.5} />
        <rect x="24" y="364" width="140" height="34" rx="17" fill={isLarge ? '#D1FAE5' : '#FFFFFF'} stroke={isLarge ? '#059669' : '#CBD5E1'} strokeWidth={isLarge ? 2.5 : 1.5} />
        <text x="94" y="386" textAnchor="middle" fill={isLarge ? '#065F46' : '#334155'}>Kalın Bağırsak</text>

        {/* Anüs */}
        {isAnus && (
          <>
            <line x1="289" y1="454" x2="394" y2="454" stroke="#7C3AED" strokeWidth="2.5" />
            <rect x="394" y="436" width="116" height="34" rx="17" fill="#EDE9FE" stroke="#7C3AED" strokeWidth="2.5" />
            <text x="452" y="458" textAnchor="middle" fill="#5B21B6">Anüs</text>
          </>
        )}
      </g>
    </svg>
  );
}
