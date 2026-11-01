// 6. sınıf Fen · Güneş Sistemi (konu 704) — etkileşimli dersin elle yazılmış altın örneği.
// Bloklar konu içeriğinin 4 bölümüne (1227–1230) karşılık gelir; soru/klasik id'leri havuzdan.
import { termSlug, type LessonDefinition, type LessonTerm } from '../types';

const TEXT = '#e2e8f0';
// Sesli anlatım için üretilmiş görseller (topic_narration_visuals); yalnız yazısız/Türkçe olanlar kullanılır —
// gezegen ve model görsellerinde İngilizce yazı ve Plüton var.
const VISUALS = 'https://pwzbjhgrhkcdyowknmhe.supabase.co/storage/v1/object/public/topic-visuals/visuals/704';
const MUTED = '#94a3b8';

type Planet = { name: string; x: number; r: number; fill: string; ring?: boolean };

const PLANETS: Planet[] = [
  { name: 'Merkür', x: 92, r: 7, fill: '#a8a29e' },
  { name: 'Venüs', x: 150, r: 11, fill: '#e9c46a' },
  { name: 'Dünya', x: 210, r: 12, fill: '#3b82f6' },
  { name: 'Mars', x: 266, r: 9, fill: '#dc5b3c' },
  { name: 'Jüpiter', x: 410, r: 36, fill: '#d4a373', ring: true },
  { name: 'Satürn', x: 520, r: 30, fill: '#e9d8a6', ring: true },
  { name: 'Uranüs', x: 620, r: 20, fill: '#7dd3fc', ring: true },
  { name: 'Neptün', x: 708, r: 19, fill: '#4c6ef5', ring: true },
];

const CY = 120;

function beltDots(): string {
  // Sabit, tekrarlanabilir dağılım (rastgele değil) — her render aynı görünür.
  const dots: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = 304 + ((i * 37) % 48);
    const y = CY - 38 + ((i * 53) % 76);
    dots.push(`<circle cx="${x}" cy="${y}" r="${1.2 + (i % 3) * 0.7}" fill="#a8a29e"/>`);
  }
  // Kavram bağı: metinde [[asteroit kuşağı]]na dokununca bu parçalar parlar.
  return `<g data-term="asteroit-kusagi">${dots.join('')}</g>`;
}

// Güneş + 8 gezegen yakınlık sırasıyla; groups: karasal/gazsal parantezleri; belt: asteroit kuşağı etiketi.
// Telefonda okunsun diye adlar büyük punto ve dönüşümlü üstte/altta (iç gezegenler birbirine yakın).
function planetLine({ groups = false, belt = false }: { groups?: boolean; belt?: boolean } = {}): string {
  const planets = PLANETS.map((p, i) => {
    const saturn = p.name === 'Satürn';
    const ring = p.ring
      ? `<ellipse data-term="halka ${termSlug(p.name)}" cx="${p.x}" cy="${CY}" rx="${p.r * 1.45}" ry="${p.r * 0.32}" fill="none" stroke="${saturn ? '#f5e6b8' : '#cbd5e1'}" stroke-width="${saturn ? 3 : 1.2}" opacity="${saturn ? 0.95 : 0.55}"/>`
      : '';
    const above = i % 2 === 1;
    const labelY = above ? CY - Math.max(p.r, 14) - 12 : CY + Math.max(p.r, 14) + 26;
    // Bölge kimlikleri: gezegenin kendisi (keşif/bul/etiketle) + gezegen + grubu; Mars ayrıca "kızıl gezegen".
    // Ad yazısı data-label: etiketleme sorusunda gizlenip yerine yuva gelir.
    const slug = termSlug(p.name);
    const terms = [slug, 'gezegen', i < 4 ? 'karasal-gezegenler' : 'gazsal-gezegenler', p.name === 'Mars' ? 'kizil-gezegen' : ''].filter(Boolean).join(' ');
    return `<circle data-term="${terms}" cx="${p.x}" cy="${CY}" r="${p.r}" fill="${p.fill}"/>${ring}<text data-label="${slug}" x="${p.x}" y="${labelY}" text-anchor="middle" font-size="25" font-weight="600" fill="${TEXT}">${p.name}</text>`;
  }).join('');
  const groupMarks = groups
    ? `<g data-term="karasal-gezegenler"><path d="M70 196 v10 h220 v-10" fill="none" stroke="#fbbf24" stroke-width="2.5"/><text x="180" y="232" text-anchor="middle" font-size="24" font-weight="700" fill="#fbbf24">Karasal (iç)</text></g>` +
      `<g data-term="gazsal-gezegenler"><path d="M365 196 v10 h370 v-10" fill="none" stroke="#38bdf8" stroke-width="2.5"/><text x="550" y="232" text-anchor="middle" font-size="24" font-weight="700" fill="#38bdf8">Gazsal (dış)</text></g>`
    : '';
  const beltLabel = belt
    ? `<g data-term="asteroit-kusagi"><text data-label="asteroit-kusagi" x="328" y="${groups ? 266 : 230}" text-anchor="middle" font-size="26" font-weight="700" fill="#f472b6">Asteroit kuşağı</text><path d="M328 ${groups ? 246 : 210} V${CY + 42}" stroke="#f472b6" stroke-width="2"/></g>`
    : '';
  const height = belt ? (groups ? 276 : 240) : groups ? 244 : 200;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 ${height}"><circle cx="-40" cy="${CY}" r="96" fill="#f59e0b"/><text x="3" y="${CY + 6}" font-size="16" font-weight="700" fill="#451a03">Güneş</text>${beltDots()}${planets}${groupMarks}${beltLabel}</svg>`;
}

// Gezegenler hacimce büyükten küçüğe, gezegen dizisiyle aynı renklerde; adlar dönüşümlü üstte/altta.
function volumeOrder(): string {
  const order: { name: string; r: number }[] = [
    { name: 'Jüpiter', r: 48 },
    { name: 'Satürn', r: 40 },
    { name: 'Uranüs', r: 27 },
    { name: 'Neptün', r: 25 },
    { name: 'Dünya', r: 14 },
    { name: 'Venüs', r: 13 },
    { name: 'Mars', r: 10 },
    { name: 'Merkür', r: 8 },
  ];
  const fill = (name: string) => PLANETS.find((p) => p.name === name)!.fill;
  let x = 20;
  const body = order
    .map((p, i) => {
      const saturn = p.name === 'Satürn';
      x += p.r + (saturn ? 14 : 0);
      const cx = x;
      x += p.r + (saturn ? 14 : 0) + 30;
      const ring = saturn ? `<ellipse cx="${cx}" cy="110" rx="${p.r * 1.5}" ry="${p.r * 0.34}" fill="none" stroke="#f5e6b8" stroke-width="3"/>` : '';
      const above = i % 2 === 1;
      const labelY = above ? 110 - Math.max(p.r, 14) - 12 : 110 + Math.max(p.r, 14) + 26;
      return `<circle cx="${cx}" cy="110" r="${p.r}" fill="${fill(p.name)}"/>${ring}<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="25" font-weight="600" fill="${TEXT}">${p.name}</text>`;
    })
    .join('');
  const arrow = `<path d="M30 206 H${x - 40}" stroke="${MUTED}" stroke-width="2" marker-end="url(#ok)"/><text x="30" y="232" font-size="17" fill="${MUTED}">büyük</text><text x="${x - 40}" y="232" text-anchor="end" font-size="17" fill="${MUTED}">küçük</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 12} 242"><defs><marker id="ok" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${MUTED}"/></marker></defs>${body}${arrow}</svg>`;
}

// Uydu ve halka grupları: üç satır alt alta (telefonda okunur), gezegenler uydu noktası ve halkasıyla
// ÇİZİLİ — bilgi sembolle (✓/✗) değil görüntüyle kodlanır. Uydu sayıları temsilîdir.
function moonRingGroups(): string {
  const fill = (name: string) => PLANETS.find((p) => p.name === name)!.fill;
  const MOON = '#e2e8f0';
  // key: satırın grup kimliği ("Görselde bul" bunu sorar; satır başlığı orada gizlenir, öğrenci çizimden okur).
  const rows: { key: string; title: string; color: string; planets: { name: string; r: number; moons: number; ring: boolean }[] }[] = [
    { key: 'uydusuz', title: 'Uydu yok · Halka yok', color: '#fda4af', planets: [{ name: 'Merkür', r: 13, moons: 0, ring: false }, { name: 'Venüs', r: 17, moons: 0, ring: false }] },
    { key: 'uydulu-halkasiz', title: 'Uydu var · Halka yok', color: '#fcd34d', planets: [{ name: 'Dünya', r: 18, moons: 1, ring: false }, { name: 'Mars', r: 14, moons: 2, ring: false }] },
    {
      key: 'halkali',
      title: 'Uydu var · Halka var',
      color: '#6ee7b7',
      planets: [
        { name: 'Jüpiter', r: 27, moons: 2, ring: true },
        { name: 'Satürn', r: 23, moons: 2, ring: true },
        { name: 'Uranüs', r: 18, moons: 1, ring: true },
        { name: 'Neptün', r: 17, moons: 1, ring: true },
      ],
    },
  ];
  const ROW_H = 116;
  const body = rows
    .map((row, ri) => {
      const top = ri * ROW_H;
      const cy = top + 64;
      const sep = ri > 0 ? `<path d="M10 ${top} H470" stroke="#5b6472" stroke-width="1.5"/>` : '';
      const planets = row.planets
        .map((p, pi) => {
          const cx = 62 + pi * 112;
          const saturn = p.name === 'Satürn';
          const ring = p.ring
            ? `<ellipse data-term="halka ${row.key}" cx="${cx}" cy="${cy}" rx="${p.r * 1.6}" ry="${p.r * 0.38}" fill="none" stroke="${saturn ? '#f5e6b8' : '#cbd5e1'}" stroke-width="${saturn ? 3.5 : 2}"/>`
            : '';
          const moons = Array.from({ length: p.moons }, (_, m) => {
            const mx = cx + p.r + 9 + m * 9;
            const my = cy - p.r + 2 + m * 10;
            return `<circle data-term="uydu ${row.key}" cx="${mx}" cy="${my}" r="4" fill="${MOON}"/>`;
          }).join('');
          return `<circle data-term="${termSlug(p.name)} gezegen ${row.key}" cx="${cx}" cy="${cy}" r="${p.r}" fill="${fill(p.name)}"/>${ring}${moons}<text data-label="${termSlug(p.name)}" x="${cx}" y="${top + 108}" text-anchor="middle" font-size="18" font-weight="600" fill="${TEXT}">${p.name}</text>`;
        })
        .join('');
      return `${sep}<text data-label="grup-basligi" x="14" y="${top + 26}" font-size="19" font-weight="800" fill="${row.color}">${row.title}</text>${planets}`;
    })
    .join('');
  const legendY = rows.length * ROW_H + 26;
  const legend =
    `<g data-term="uydu"><circle cx="22" cy="${legendY - 6}" r="4" fill="${MOON}"/><text x="34" y="${legendY}" font-size="17" fill="${MUTED}">uydu</text></g>` +
    `<g data-term="halka"><ellipse cx="112" cy="${legendY - 6}" rx="16" ry="5" fill="none" stroke="#cbd5e1" stroke-width="2"/><text x="136" y="${legendY}" font-size="17" fill="${MUTED}">halka</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 ${legendY + 12}">${body}${legend}</svg>`;
}

// Güneş sistemi modeli: koli kartonu üstünde Güneş, hacim sırasına uygun toplar, asteroit kuşağı için taşlar.
// Toplar kum/oyun hamuru renginde (gerçek gezegen değil, MODEL olduğu belli olsun); üstte malzeme etiketleri.
function modelBoard(): string {
  const balls: { name: string; x: number; r: number; fill: string; above?: boolean; ring?: boolean }[] = [
    { name: 'Merkür', x: 118, r: 8, fill: '#e5e7eb' },
    { name: 'Venüs', x: 160, r: 12, fill: '#fde68a', above: true },
    { name: 'Dünya', x: 205, r: 13, fill: '#60a5fa' },
    { name: 'Mars', x: 247, r: 10, fill: '#f87171', above: true },
    { name: 'Jüpiter', x: 372, r: 42, fill: '#fb923c' },
    { name: 'Satürn', x: 484, r: 34, fill: '#fcd34d', ring: true, above: true },
    { name: 'Uranüs', x: 590, r: 22, fill: '#67e8f9' },
    { name: 'Neptün', x: 676, r: 21, fill: '#818cf8', above: true },
  ];
  const CYB = 178;
  const stones = `<g data-term="asteroit-kusagi">${Array.from({ length: 9 }, (_, i) => `<circle cx="${282 + (i % 3) * 13}" cy="${CYB - 16 + Math.floor(i / 3) * 15}" r="${3 + (i % 2)}" fill="#78716c"/>`).join('')}</g>`;
  const body = balls
    .map((b) => {
      const slug = termSlug(b.name);
      const ring = b.ring ? `<ellipse data-term="${slug}" cx="${b.x}" cy="${CYB}" rx="${b.r * 1.55}" ry="${b.r * 0.35}" fill="none" stroke="#78350f" stroke-width="3"/>` : '';
      const ly = b.above ? CYB - b.r - 14 : CYB + b.r + 28;
      return `<circle data-term="${slug} model-top" cx="${b.x}" cy="${CYB}" r="${b.r}" fill="${b.fill}" stroke="#78350f" stroke-width="1.5"/>${ring}<text data-label="${slug}" x="${b.x}" y="${ly}" text-anchor="middle" font-size="21" font-weight="700" fill="#3b2412">${b.name}</text>`;
    })
    .join('');
  // Üst işaretler kartonun üstünde; yan yana çakışmasın diye "küçük taşlar" kartonun altında.
  const callout = (x: number, y: number, text: string) =>
    `<g data-label="ipucu"><path d="M${x} 44 V${y}" stroke="${TEXT}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${x}" y="32" text-anchor="middle" font-size="20" font-weight="700" fill="${TEXT}">${text}</text></g>`;
  const calloutBelow = (x: number, y: number, text: string) =>
    `<g data-label="ipucu"><path d="M${x} ${y} V302" stroke="${TEXT}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${x}" y="324" text-anchor="middle" font-size="20" font-weight="700" fill="${TEXT}">${text}</text></g>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 334">` +
    `<rect data-term="gunes-sistemi-modeli" x="10" y="60" width="740" height="230" rx="14" fill="#c8a173" stroke="#8b6a42" stroke-width="3"/>` +
    `<path d="M10 120 a70 70 0 0 1 0 116 z" fill="#f59e0b"/><text x="16" y="${CYB + 6}" font-size="16" font-weight="700" fill="#451a03">Güneş</text>` +
    stones +
    body +
    callout(118, CYB - 12, 'pinpon topu') +
    calloutBelow(295, CYB + 20, 'küçük taşlar') +
    callout(372, CYB - 46, 'basketbol topu') +
    `<text x="740" y="282" text-anchor="end" font-size="16" fill="#5b3a1a">koli kartonu</text>` +
    `</svg>`
  );
}

// Dış gezegenler hacim sırasıyla farklı boyutta, numaralı ve aynı renkte (renkten değil boyuttan tanınsın).
function outerPlanetsNumbered(): string {
  const items = [
    { n: 1, x: 120, r: 54, saturn: true },
    { n: 2, x: 300, r: 34 },
    { n: 3, x: 480, r: 70 },
    { n: 4, x: 660, r: 38 },
  ];
  const body = items
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="105" r="${p.r}" fill="#64748b"/>` +
        `<ellipse cx="${p.x}" cy="105" rx="${p.r * (p.saturn ? 1.75 : 1.35)}" ry="${p.r * (p.saturn ? 0.42 : 0.26)}" fill="none" stroke="${p.saturn ? '#f5e6b8' : '#cbd5e1'}" stroke-width="${p.saturn ? 5 : 1.2}" opacity="${p.saturn ? 0.95 : 0.5}"/>` +
        `<text x="${p.x}" y="${105 + 10}" text-anchor="middle" font-size="28" font-weight="800" fill="#ffffff">${p.n}</text>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 210">${body}</svg>`;
}

// Uzay → atmosfer → yer: aynı kaya parçasının aldığı adlar + atmosferde yanıp biten bir meteor.
function meteorDiagram(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 284">` +
    `<rect x="0" y="95" width="780" height="100" fill="#38bdf8" fill-opacity="0.2"/>` +
    `<rect x="0" y="195" width="780" height="85" fill="#57391f"/>` +
    `<text x="12" y="24" font-size="20" fill="${MUTED}">UZAY</text><text x="12" y="115" font-size="20" fill="${MUTED}">ATMOSFER</text><text x="12" y="215" font-size="20" fill="#d6b48a">YERYÜZÜ</text>` +
    `<circle cx="120" cy="20" r="1.3" fill="#fff"/><circle cx="420" cy="34" r="1.1" fill="#fff"/><circle cx="700" cy="18" r="1.4" fill="#fff"/><circle cx="560" cy="60" r="1" fill="#fff"/>` +
    // gök taşı
    `<g data-term="gok-tasi"><path d="M150 52 l10 -7 l11 3 l4 10 l-7 9 l-12 0 l-7 -7 z" fill="#a8a29e"/><text x="162" y="88" text-anchor="middle" font-size="26" font-weight="700" fill="${TEXT}" data-label="gok-tasi">gök taşı</text></g>` +
    // meteor (ışık çizgisi)
    `<g data-term="meteor"><path d="M300 70 L392 150" stroke="#fb923c" stroke-width="9" stroke-linecap="round" stroke-opacity="0.75"/><circle cx="394" cy="152" r="7" fill="#fdba74"/><text data-label="meteor" x="412" y="160" font-size="26" font-weight="700" fill="#fdba74">meteor</text></g>` +
    // atmosferde yanıp biten
    `<g data-term="meteor"><path d="M520 92 L566 140" stroke="#fb923c" stroke-width="5" stroke-linecap="round" stroke-opacity="0.45"/><text x="572" y="128" font-size="19" fill="${MUTED}">çoğu burada</text><text x="572" y="148" font-size="19" fill="${MUTED}">yanıp biter</text></g>` +
    // meteorit + çukur
    `<path data-term="meteor-cukuru" d="M560 196 q60 34 120 0" fill="#3b2412"/><path data-term="meteorit" d="M606 204 l8 -6 l10 1 l5 8 l-6 6 l-11 0 z" fill="#78716c"/>` +
    `<text data-term="meteorit" data-label="meteorit" x="680" y="256" text-anchor="middle" font-size="26" font-weight="700" fill="${TEXT}">meteorit</text>` +
    `<path d="M560 208 L520 236" stroke="#d6b48a" stroke-width="1.5"/><text data-term="meteor-cukuru" data-label="meteor-cukuru" x="470" y="262" text-anchor="middle" font-size="22" font-weight="700" fill="#d6b48a">meteor çukuru</text>` +
    `</svg>`
  );
}

const NASA = '/lesson-media/gunes-sistemi';

// Gezegen KAVRAM KARTLARI: keşif haritası, çözüm açıklamaları ve örnek cevaplar aynı kartı açar.
// Görseller NASA kaynaklı, kamu malı (public/lesson-media/gunes-sistemi/KAYNAKLAR.md).
// Bilgiler konu içeriğinden (bölüm 1227-1228); "Hacim" sırası büyükten küçüğe.
const PLANET_CONCEPTS: Record<string, LessonTerm> = Object.fromEntries([
  { term: 'merkur', title: 'Merkür', note: "Güneş'e en yakın gezegen", facts: [['Güneş\'e yakınlık', '1. sıra'], ['Hacim', 'En küçük (8.)'], ['Yapı', 'Karasal'], ['Uydu', '✗'], ['Halka', '✗']] },
  { term: 'venus', title: 'Venüs', note: 'En sıcak gezegen', facts: [['Güneş\'e yakınlık', '2. sıra'], ['Hacim', '6. büyük'], ['Yapı', 'Karasal'], ['Uydu', '✗'], ['Halka', '✗']] },
  { term: 'dunya', title: 'Dünya', note: 'Canlı yaşamı olduğu bilinen tek gezegen', facts: [['Güneş\'e yakınlık', '3. sıra'], ['Hacim', '5. büyük'], ['Yapı', 'Karasal'], ['Uydu', '✓'], ['Halka', '✗']] },
  { term: 'mars', title: 'Mars', note: 'Kızıl gezegen diye anılır', facts: [['Güneş\'e yakınlık', '4. sıra'], ['Hacim', '7. büyük'], ['Yapı', 'Karasal'], ['Uydu', '✓'], ['Halka', '✗']] },
  { term: 'jupiter', title: 'Jüpiter', note: 'Hacimce en büyük gezegen', facts: [['Güneş\'e yakınlık', '5. sıra'], ['Hacim', 'En büyük (1.)'], ['Yapı', 'Gazsal'], ['Uydu', '✓'], ['Halka', '✓']] },
  { term: 'saturn', title: 'Satürn', note: 'Halkaları en belirgin gezegen', facts: [['Güneş\'e yakınlık', '6. sıra'], ['Hacim', '2. büyük'], ['Yapı', 'Gazsal'], ['Uydu', '✓'], ['Halka', '✓']] },
  { term: 'uranus', title: 'Uranüs', note: 'Hacimce üçüncü büyük gezegen', facts: [['Güneş\'e yakınlık', '7. sıra'], ['Hacim', '3. büyük'], ['Yapı', 'Gazsal'], ['Uydu', '✓'], ['Halka', '✓']] },
  { term: 'neptun', title: 'Neptün', note: "Güneş'e en uzak gezegen", facts: [['Güneş\'e yakınlık', '8. sıra'], ['Hacim', '4. büyük'], ['Yapı', 'Gazsal'], ['Uydu', '✓'], ['Halka', '✓']] },
].map((p) => [
  p.term,
  {
    title: p.title,
    description: p.note,
    icon: '🪐',
    image: { url: `${NASA}/${p.term}.webp`, alt: `${p.title} gezegeninin uzay aracından çekilmiş fotoğrafı`, credit: 'NASA' },
    facts: p.facts.map(([label, value]) => ({ label, value })),
  },
]));

export const lesson704: LessonDefinition = {
  topicId: 704,
  // Anlatıcı robotun bu derse özel hikâyesi (açılış/kapanış).
  guide: {
    intro: "Merhaba kaptan! Ben Bit. Uzay gemimin rota haritası silindi. Güneş sistemini birlikte keşfedip rotayı yeniden kuralım mı?",
    finish: "Başardık kaptan! Rotamı kurtardın. Güneş sistemini artık çok iyi tanıyorsun.",
  },
  // Anahtar kavramlarda olmayan kavram bağları (diğerleri — gök taşı, meteor, kızıl gezegen… — anahtar kavramlardan gelir).
  terms: {
    ...PLANET_CONCEPTS,
    uydu: { title: 'Uydu', description: "Bir gezegenin çevresinde dolanan gök cismidir. Ay, Dünya'nın uydusudur.", icon: '🌙' },
    halka: { title: 'Gezegen halkası', description: 'Bazı gezegenlerin çevresini saran halka biçimli yapıdır. Güneş sisteminde dıştaki dört gezegende bulunur.', icon: '🪐' },
    'meteor-cukuru': { title: 'Meteor çukuru', description: 'Yeryüzüne ulaşan meteoritin düştüğü yerde açtığı çukurdur.', icon: '🕳️' },
  },
  blocks: [
    {
      sectionId: 1227,
      title: 'Gezegenleri tanıyalım',
      steps: [
        {
          kind: 'kesif',
          title: 'Gezegenleri keşfet',
          predict: { question: 'Sence Güneş sisteminin en sıcak gezegeni hangisi?', options: ['Merkür', 'Venüs', 'Mars'], answer: 1 },
          intro: 'Güneş sisteminde sekiz gezegen var. Her birine dokun, yakından tanı.',
          map: { kind: 'svg', svg: planetLine(), caption: "Gezegenler Güneş'e yakınlık sırasıyla. Boyutlar ölçekli değildir." },
          items: PLANETS.map((p) => ({ term: termSlug(p.name) })),
          misconception: { wrong: "Güneş'e en yakın gezegen en sıcak gezegendir.", right: "Güneş'e en yakın gezegen Merkür'dür, ama en sıcak gezegen Venüs'tür." },
        },
        {
          kind: 'anlatim',
          title: 'Hacim sırası',
          body: 'Kolay hatırlama: büyük dörtlü dışarıda, küçük dörtlü içeride. **Dünya**, içteki dört gezegenin en büyüğüdür.',
          visual: { kind: 'svg', svg: volumeOrder(), caption: 'Hacimce büyükten küçüğe. Boyutlar yalnız sırayı gösterir, ölçekli değildir.' },
        },
        {
          kind: 'etiketle',
          prompt: 'Gezegenlerin adlarını haritadaki yerlerine yerleştir.',
          map: { kind: 'svg', svg: planetLine() },
          // Telefonda yuvalar çakışmasın diye aynı sıradaki (üst/alt) adlar arasında boşluk kalacak şekilde seçildi.
          labels: [
            { term: 'merkur', text: 'Merkür' },
            { term: 'mars', text: 'Mars' },
            { term: 'jupiter', text: 'Jüpiter' },
            { term: 'saturn', text: 'Satürn' },
            { term: 'neptun', text: 'Neptün' },
          ],
          explanation: "Güneş'e yakınlık sırası: Merkür, Venüs, Dünya, Mars, Jüpiter, Satürn, Uranüs, Neptün.",
        },
        {
          kind: 'bul',
          prompt: 'Haritada doğru gezegene dokun.',
          map: { kind: 'svg', svg: planetLine() },
          zones: PLANETS.map((p) => ({ term: termSlug(p.name), name: p.name })),
          questions: [
            { prompt: 'Hacimce en büyük gezegene dokun.', term: 'jupiter' },
            { prompt: 'Kızıl gezegene dokun.', term: 'mars' },
            { prompt: 'Halkaları en belirgin gezegene dokun.', term: 'saturn' },
            { prompt: 'En sıcak gezegene dokun.', term: 'venus' },
          ],
          explanation: 'Jüpiter en büyük, Mars kızıl, Satürn halkaları en belirgin, Venüs en sıcak gezegendir.',
        },
        {
          kind: 'eslestirme',
          prompt: 'Şekilde dıştaki dört gezegen, hacim sırasına uygun boyutlarda çizildi. Her numarayı doğru gezegenle eşleştir.',
          visual: { kind: 'svg', svg: outerPlanetsNumbered(), caption: 'Boyutlar yalnızca hacim sırasını gösterir, ölçekli değildir.' },
          targets: ['Jüpiter', 'Satürn', 'Uranüs', 'Neptün'],
          items: [
            { text: '1 numara', target: 1 },
            { text: '2 numara', target: 3 },
            { text: '3 numara', target: 0 },
            { text: '4 numara', target: 2 },
          ],
          explanation: 'En büyük olan 3 numara Jüpiter. Halkası en belirgin olan 1 numara Satürn. Uranüs (4), Neptün\'den (2) biraz büyüktür.',
        },
        { kind: 'soru', questionId: 6715 },
        { kind: 'soru', questionId: 6717 },
        { kind: 'soru', questionId: 6716 },
        { kind: 'klasik', questionId: 9662 },
      ],
    },
    {
      sectionId: 1228,
      title: 'Gezegenleri gruplandıralım',
      steps: [
        {
          kind: 'anlatim',
          title: 'Karasal ve gazsal gezegenler',
          body:
            "Gezegenler yapılarına göre iki gruba ayrılır. Güneş'e yakın dördü [[karasaldır|karasal-gezegenler]]: yüzeyleri kayalıktır, iç gezegenler de denir.\n\n" +
            'Dıştaki dördü [[gazsaldır|gazsal-gezegenler]]: çoğunlukla gazdan oluşurlar, dış gezegenler de denir.',
          visual: { kind: 'svg', svg: planetLine({ groups: true }), caption: 'Boyutlar ölçekli değildir.' },
        },
        {
          kind: 'anlatim',
          title: 'Uydu ve halkaya göre gruplar',
          predict: { question: 'Sence hangi gezegenlerin halkası var?', options: ["Yalnız Satürn'ün", 'Dıştaki dört gezegenin', 'Bütün gezegenlerin'], answer: 1 },
          body: "Güneş'ten uzaklaştıkça örüntüye bak: önce ne [[uydu]] ne [[halka]], sonra **yalnız uydu**, en dışta **uydu ve halka**.",
          misconception: { wrong: 'Uydusu olan her gezegen gazsaldır.', right: "Dünya ve Mars'ın da uydusu vardır, ama ikisi de karasaldır." },
          visual: { kind: 'svg', svg: moonRingGroups(), caption: 'Uydu sayıları temsilîdir; boyutlar ölçekli değildir.' },
        },
        {
          kind: 'eslestirme',
          prompt: 'Gezegenleri yapılarına göre grupla.',
          targets: ['Karasal', 'Gazsal'],
          items: [
            { text: 'Satürn', target: 1 },
            { text: 'Mars', target: 0 },
            { text: 'Venüs', target: 0 },
            { text: 'Neptün', target: 1 },
            { text: 'Merkür', target: 0 },
            { text: 'Jüpiter', target: 1 },
            { text: 'Dünya', target: 0 },
            { text: 'Uranüs', target: 1 },
          ],
          explanation: "Güneş'e yakın ilk dört gezegen karasal, dıştaki dört gezegen gazsaldır.",
        },
        {
          kind: 'eslestirme',
          prompt: 'Gezegenleri uydu ve halka durumuna göre grupla.',
          targets: ['Uydu yok, halka yok', 'Uydu var, halka yok', 'Uydu var, halka var'],
          items: [
            { text: 'Neptün', target: 2 },
            { text: 'Venüs', target: 0 },
            { text: 'Mars', target: 1 },
            { text: 'Merkür', target: 0 },
            { text: 'Uranüs', target: 2 },
            { text: 'Dünya', target: 1 },
          ],
          explanation: 'Merkür ve Venüs\'ün ikisi de yok; Dünya ve Mars\'ın yalnız uydusu var; gazsal gezegenlerin hepsinin uydusu ve halkası var.',
        },
        {
          kind: 'bul',
          prompt: 'Çizimde doğru gezegene dokun.',
          map: { kind: 'svg', svg: moonRingGroups() },
          // Satır başlıkları ("Halka var" gibi) gizli: öğrenci uyduları ve halkaları çizimden okur.
          hideLabels: ['grup-basligi'],
          zones: [
            { term: 'uydusuz', name: 'uydusu ve halkası olmayan bir gezegen' },
            { term: 'uydulu-halkasiz', name: 'uydusu olup halkası olmayan bir gezegen' },
            { term: 'halkali', name: 'halkası olan bir gezegen' },
          ],
          questions: [
            { prompt: 'Halkası olan bir gezegene dokun.', term: 'halkali' },
            { prompt: 'Uydusu da halkası da olmayan bir gezegene dokun.', term: 'uydusuz' },
            { prompt: 'Uydusu olan ama halkası olmayan bir gezegene dokun.', term: 'uydulu-halkasiz' },
          ],
          explanation: 'Merkür ve Venüs: ikisi de yok. Dünya ve Mars: yalnız uydu. Dıştaki dört gezegen: uydu ve halka.',
        },
        { kind: 'soru', questionId: 6718 },
        { kind: 'soru', questionId: 6722 },
        { kind: 'soru', questionId: 6724 },
        { kind: 'klasik', questionId: 9728 },
      ],
    },
    {
      sectionId: 1229,
      title: 'Asteroit kuşağı ve gök taşları',
      steps: [
        {
          kind: 'anlatim',
          title: 'Asteroit kuşağı',
          body:
            '**Mars** ile **Jüpiter** arasında [[asteroit kuşağı|asteroit-kusagi]] bulunur. Bu kuşakta farklı büyüklük ve şekillerde sayısız kaya ve metal parçası vardır.\n\n' +
            'Asteroit kuşağı, karasal gezegenleri gazsal gezegenlerden ayıran bir sınır gibidir.',
          visual: { kind: 'svg', svg: planetLine({ groups: true, belt: true }), caption: 'Boyutlar ve uzaklıklar ölçekli değildir.' },
        },
        {
          kind: 'anlatim',
          title: 'Gök taşı, meteor, meteorit',
          predict: { question: 'Sence Dünya atmosferine giren gök taşlarının çoğuna ne olur?', options: ['Yere düşüp çukur açar', 'Atmosferde yanıp biter', 'Uzaya geri döner'], answer: 1 },
          misconception: { wrong: 'Atmosfere giren her gök taşı yere düşer ve çukur açar.', right: 'Çoğu sürtünmeyle yanıp biter; yalnız yere ulaşabilenler meteorittir.' },
          body:
            'Çoğu asteroitlerden kopmuş küçük kaya parçalarına [[gök taşı|gok-tasi]] denir. Uzayda serbestçe dolanırlar.\n\n' +
            'Dünya atmosferine giren gök taşı [[meteor]] olur: sürtünmeyle ısınır ve gökyüzünde bir ışık çizgisi oluşturur.\n\n' +
            'Tamamen yanmayıp yere ulaşan parça [[meteorit]]tir. Yerde açtığı çukura [[meteor çukuru|meteor-cukuru]] denir.',
          visual: { kind: 'svg', svg: meteorDiagram(), caption: 'Aynı kaya parçası, bulunduğu yere göre farklı ad alır.' },
        },
        {
          kind: 'bosluk',
          prompt: 'Kelimeleri doğru boşluklara yerleştir.',
          visual: { kind: 'resim', imageUrl: `${VISUALS}/meteorit.jpeg`, alt: 'Yere düşmüş bir kaya parçası ve çevresinde açılmış çukura bakan çocuklar' },
          text:
            'Uzayda serbestçe dolanan küçük kaya parçasına {0} denir. Bu parça Dünya atmosferine girip ışık çizgisi oluşturursa {1} adını alır. ' +
            'Atmosferde tamamen yanmayıp yere ulaşırsa {2} olur ve yerde bir {3} açabilir.',
          answers: ['gök taşı', 'meteor', 'meteorit', 'meteor çukuru'],
          distractors: ['asteroit kuşağı', 'uydu'],
          explanation: 'Uzayda gök taşı → atmosferde meteor → yerde meteorit. Meteoritin açtığı çukur meteor çukurudur.',
        },
        {
          kind: 'etiketle',
          prompt: 'Kaya parçasının her aşamadaki adını şemadaki yerine yerleştir.',
          map: { kind: 'svg', svg: meteorDiagram() },
          labels: [
            { term: 'gok-tasi', text: 'gök taşı' },
            { term: 'meteor', text: 'meteor' },
            { term: 'meteorit', text: 'meteorit' },
            { term: 'meteor-cukuru', text: 'meteor çukuru' },
          ],
          explanation: 'Uzayda gök taşı, atmosferde meteor, yerde meteorit; meteoritin açtığı çukur meteor çukurudur.',
        },
        { kind: 'soru', questionId: 7154 },
        { kind: 'soru', questionId: 7158 },
        { kind: 'soru', questionId: 7161 },
        { kind: 'klasik', questionId: 9672 },
      ],
    },
    {
      sectionId: 1230,
      title: 'Güneş sistemi modeli',
      steps: [
        {
          kind: 'anlatim',
          title: 'Model tasarlayalım',
          body:
            "Bir [[Güneş sistemi modeli|gunes-sistemi-modeli]], gezegenlerin hacimlerini ve Güneş'e uzaklıklarını temsil eder.\n\n" +
            'Koli kartonu, oyun hamuru, toplar ve küçük taşlar yeter: **en büyük top Jüpiter**, **en küçük top Merkür** olur.',
          visual: { kind: 'svg', svg: modelBoard(), caption: 'Örnek model: toplar gezegenlerin hacim sırasını gösterir.' },
        },
        {
          kind: 'anlatim',
          title: 'Modeli yeni kanıtlarla yenileyelim',
          body: 'Model bir kez yapılıp bırakılmaz. Bir eksik ya da hata bulursan modelini yeni kanıtlara göre düzelt. Bilim insanları da modellerini yeni kanıtlarla böyle geliştirir.',
          visual: {
            kind: 'akis',
            steps: [
              { label: 'Diğer modellerle karşılaştır', icon: 'Users' },
              { label: 'Bilimsel kaynaklardan kontrol et', icon: 'BookOpen' },
              { label: 'Öğretmenin geri bildirimini al', icon: 'Lightbulb' },
              { label: 'Modelini düzelt', icon: 'Pencil' },
            ],
          },
        },
        {
          kind: 'dogru_yanlis',
          prompt: 'Bir grubun hazırladığı Güneş sistemi modeliyle ilgili ifadeleri Doğru ya da Yanlış olarak işaretle.',
          statements: [
            { text: "Modelde en büyük nesne Jüpiter'i temsil etmelidir.", correct: true, note: 'Jüpiter hacimce en büyük gezegendir.' },
            {
              text: 'Karasal gezegenler, gazsal gezegenlerden daha büyük nesnelerle gösterilmelidir.',
              correct: false,
              note: 'Tersi: gazsal gezegenler daha büyüktür, büyük nesneler onlara verilmelidir.',
            },
            { text: 'Asteroit kuşağı Dünya ile Mars arasına yerleştirilmelidir.', correct: false, note: 'Asteroit kuşağı Mars ile Jüpiter arasındadır.' },
            {
              text: "Neptün'e halka eklenmemelidir, çünkü halka yalnız Satürn'de vardır.",
              correct: false,
              note: "Dört gazsal gezegenin de halkası vardır; Satürn'ün halkaları yalnızca en belirgin olanlardır.",
            },
            { text: 'Model, bilimsel kaynaklar ve geri bildirimlerle düzeltilerek geliştirilebilir.', correct: true, note: 'Modeller yeni kanıtlarla yenilenir.' },
          ],
        },
        {
          kind: 'bul',
          prompt: 'Modelde doğru topa dokun.',
          map: { kind: 'svg', svg: modelBoard() },
          // Top adları ve "pinpon/basketbol topu" ipuçları gizli: öğrenci büyüklükten çıkarır.
          hideLabels: [...PLANETS.map((p) => termSlug(p.name)), 'ipucu'],
          zones: [...PLANETS.map((p) => ({ term: termSlug(p.name), name: `${p.name} topu` })), { term: 'asteroit-kusagi', name: 'küçük taşlar' }],
          questions: [
            { prompt: "Jüpiter'i temsil eden topa dokun.", term: 'jupiter' },
            { prompt: "Merkür'ü temsil eden topa dokun.", term: 'merkur' },
            { prompt: 'Asteroit kuşağını gösteren yere dokun.', term: 'asteroit-kusagi' },
            { prompt: "Halkalı Satürn'ü temsil eden topa dokun.", term: 'saturn' },
          ],
          explanation: 'En büyük top Jüpiter, en küçük top Merkür. Küçük taşlar Mars ile Jüpiter arasındaki asteroit kuşağıdır.',
        },
        { kind: 'soru', questionId: 6719 },
        { kind: 'soru', questionId: 6723 },
        { kind: 'soru', questionId: 6386 },
        { kind: 'klasik', questionId: 9673 },
      ],
    },
  ],
};
