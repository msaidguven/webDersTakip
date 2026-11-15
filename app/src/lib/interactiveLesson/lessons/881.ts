// 7. sınıf Din Kültürü · Hac ve Umre İbadeti (konu 881) — KEŞİF HARİTASI örneği (yalnız bölüm 3, "Hac İbadetinin
// Mekânları ve Yapılış Aşamaları", topic_content_sections 1975; tavaf/say bilgisi bölüm 1974'ten).
// Harita ŞEMATİKTİR: yalnız mekânlar ve yol; insan/kutsal kişi tasviri YOK, uzaklıklar ölçekli değil.
// İçerik konu metninden; havuzda klasik soru yok → "Konuyu anladık mı?" derste yazıldı.
import type { LessonDefinition } from '../types';

const INK = '#1f2937';

// Mekke'den doğuya: Mescid-i Haram (Kâbe, Safa-Merve) → Mina → Müzdelife → Arafat; üstte haccın sırası (1→4).
function hajjMap(): string {
  const place = (term: string, x: number, name: string) =>
    `<text data-label="${term}" x="${x}" y="292" text-anchor="middle" font-size="26" font-weight="800" fill="${INK}">${name}</text>`;
  const step = (x: number, y: number, n: number) =>
    `<circle cx="${x}" cy="${y}" r="17" fill="#f59e0b" stroke="${INK}" stroke-width="2"/><text x="${x}" y="${y + 7}" text-anchor="middle" font-size="20" font-weight="800" fill="${INK}">${n}</text>`;
  const tents = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const x = 330 + (i % 3) * 30;
      const y = 200 + Math.floor(i / 3) * 28;
      return `<path d="M${x} ${y + 22} l14 -22 l14 22 z" fill="#f8fafc" stroke="${INK}" stroke-width="1.5"/>`;
    })
    .join('');
  const stones = Array.from({ length: 14 }, (_, i) => `<circle cx="${505 + (i % 7) * 11}" cy="${222 + Math.floor(i / 7) * 12}" r="3.5" fill="#57534e"/>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 400">` +
    `<rect x="8" y="30" width="804" height="300" rx="18" fill="#c9b48a"/>` +
    // yol
    `<path d="M200 230 H720" stroke="#ede3cc" stroke-width="12" stroke-linecap="round"/>` +
    // Mekke + Mescid-i Haram
    `<rect x="24" y="48" width="232" height="268" rx="16" fill="#dccaa3" stroke="#8b7653" stroke-width="2"/>` +
    `<text x="40" y="78" font-size="22" font-weight="700" fill="#5b4a2e">Mekke</text>` +
    `<rect x="52" y="104" width="150" height="160" rx="10" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/>` +
    `<g data-term="kabe"><rect x="112" y="158" width="32" height="32" fill="#111827"/><rect x="112" y="166" width="32" height="5" fill="#d4a017"/></g>` +
    `<text data-label="kabe" x="128" y="222" text-anchor="middle" font-size="22" font-weight="800" fill="${INK}">Kâbe</text>` +
    `<g data-term="safa-merve"><ellipse cx="226" cy="118" rx="20" ry="11" fill="#a8a29e"/><ellipse cx="226" cy="252" rx="20" ry="11" fill="#a8a29e"/>` +
    `<path d="M226 130 V240" stroke="#78716c" stroke-width="3" stroke-dasharray="6 5"/>` +
    `<text x="226" y="100" text-anchor="middle" font-size="17" font-weight="700" fill="#5b4a2e">Safa</text><text x="226" y="282" text-anchor="middle" font-size="17" font-weight="700" fill="#5b4a2e">Merve</text></g>` +
    // Mina, Müzdelife, Arafat
    `<g data-term="mina">${tents}</g>` +
    place('mina', 374, 'Mina') +
    `<g data-term="muzdelife"><ellipse cx="540" cy="232" rx="56" ry="26" fill="#d6c7a4" stroke="#8b7653" stroke-width="1.5"/>${stones}</g>` +
    place('muzdelife', 540, 'Müzdelife') +
    `<g data-term="arafat"><path d="M650 262 L708 168 L770 262 Z" fill="#8b6f47" stroke="#5b4a2e" stroke-width="2"/><path d="M708 168 L722 190 L694 190 Z" fill="#a8895f"/></g>` +
    place('arafat', 710, 'Arafat') +
    // haccın sırası
    step(710, 146, 1) +
    step(540, 180, 2) +
    step(374, 166, 3) +
    step(128, 138, 4) +
    `<text x="410" y="362" text-anchor="middle" font-size="19" font-weight="700" fill="#e2e8f0">1 Arafat (vakfe) → 2 Müzdelife → 3 Mina → 4 Kâbe (ziyaret tavafı)</text>` +
    `</svg>`
  );
}

const MAP = hajjMap();

export const lesson881: LessonDefinition = {
  topicId: 881,
  // Anlatıcı robotun bu derse özel hikâyesi (açılış/kapanış).
  guide: {
    intro: "Merhaba! Ben Atom. Bugün haritada hac ibadetinin yapıldığı mekânları ve aşamalarını sırayla keşfedeceğiz. Hazırsan başlayalım!",
    finish: "Tebrikler! Hac ibadetinin mekânlarını ve aşamalarını sırasıyla öğrendin.",
  },
  terms: {
    kabe: {
      title: 'Kâbe',
      description: 'Yeryüzündeki ilk mabet; tavaf etrafında yapılır.',
      icon: '🕋',
      facts: [
        { label: 'Yapılan', value: 'Tavaf (7 şavt)' },
        { label: 'Farz olan', value: 'Ziyaret tavafı' },
        { label: 'Ayrılırken', value: 'Veda tavafı' },
      ],
    },
    'safa-merve': {
      title: 'Safa ve Merve',
      description: 'Say, bu iki tepe arasında yedi kez gidip gelmektir.',
      iconName: 'Footprints',
      facts: [
        { label: 'Yapılan', value: 'Say' },
        { label: 'Sayısı', value: '4 gidiş, 3 dönüş' },
        { label: 'Hatıra', value: "Hz. Hacer'in su araması" },
      ],
      aliases: ['Safa ile Merve'],
    },
    arafat: {
      title: 'Arafat',
      description: 'Haccın farzı olan vakfe burada yapılır.',
      iconName: 'Mountain',
      facts: [
        { label: 'Ne zaman', value: 'Arife günü' },
        { label: 'Yapılan', value: 'Vakfe (bekleyiş)' },
        { label: 'Namaz', value: 'Öğle + ikindi birlikte' },
        { label: 'Hükmü', value: 'Farz' },
      ],
    },
    muzdelife: {
      title: 'Müzdelife',
      description: 'Gün batınca gelinir; şeytan taşlamak için taş toplanır.',
      iconName: 'Moon',
      facts: [
        { label: 'Ne zaman', value: "Arafat'tan sonra, gece" },
        { label: 'Namaz', value: 'Akşam + yatsı birlikte' },
        { label: 'Yapılan', value: 'Vakfe, taş toplama' },
        { label: 'Hükmü', value: 'Vacip' },
      ],
    },
    mina: {
      title: 'Mina',
      description: 'Bayramın ilk günü şeytan taşlanır, kurban kesilir.',
      iconName: 'Tent',
      facts: [
        { label: 'Ne zaman', value: 'Bayramın 1. günü' },
        { label: 'Yapılan', value: 'Şeytan taşlama, kurban' },
        { label: 'Sonra', value: 'Tıraş, ihramdan çıkış' },
      ],
    },
  },
  blocks: [
    {
      sectionId: 1975,
      title: 'Haccın mekânları',
      steps: [
        {
          kind: 'kesif',
          title: 'Hac mekânlarını keşfet',
          predict: { question: 'Sence haccın farzı olan vakfe nerede yapılır?', options: ['Mina', 'Arafat', 'Müzdelife'], answer: 1 },
          intro: 'Her mekâna dokun: orada ne yapıldığını ve haccın hangi aşaması olduğunu gör.',
          map: { kind: 'svg', svg: MAP, caption: 'Şematik harita; uzaklıklar ölçekli değildir.' },
          items: ['kabe', 'safa-merve', 'arafat', 'muzdelife', 'mina'].map((term) => ({ term })),
          misconception: { wrong: "Hacda şeytan taşlama Arafat'ta yapılır.", right: "Şeytan taşlama Mina'da yapılır; Arafat'ta vakfe yapılır." },
        },
        {
          kind: 'siralama',
          prompt: 'Haccın aşamalarını sırasıyla diz.',
          items: ["Arafat'ta vakfe", "Müzdelife'de taş toplama", "Mina'da şeytan taşlama", 'Tıraş olup ihramdan çıkma', 'Ziyaret tavafı', 'Veda tavafı'],
          explanation: "Arife günü Arafat, gece Müzdelife, bayramın ilk günü Mina; ihramdan çıkınca ziyaret tavafı, Mekke'den ayrılırken veda tavafı.",
        },
        {
          kind: 'etiketle',
          prompt: 'Mekânların adlarını haritadaki yerlerine yerleştir.',
          map: { kind: 'svg', svg: MAP },
          labels: [
            { term: 'kabe', text: 'Kâbe' },
            { term: 'mina', text: 'Mina' },
            { term: 'muzdelife', text: 'Müzdelife' },
            { term: 'arafat', text: 'Arafat' },
          ],
          explanation: "Mekke'den doğuya doğru Mina, Müzdelife ve Arafat sıralanır.",
        },
        {
          kind: 'bul',
          prompt: 'Haritada doğru mekâna dokun.',
          map: { kind: 'svg', svg: MAP },
          zones: [
            { term: 'kabe', name: 'Kâbe' },
            { term: 'safa-merve', name: 'Safa ve Merve' },
            { term: 'mina', name: 'Mina' },
            { term: 'muzdelife', name: 'Müzdelife' },
            { term: 'arafat', name: 'Arafat' },
          ],
          questions: [
            { prompt: 'Haccın farzı olan vakfenin yapıldığı yere dokun.', term: 'arafat' },
            { prompt: 'Şeytan taşlamak için taş toplanan yere dokun.', term: 'muzdelife' },
            { prompt: 'Kurban kesilen yere dokun.', term: 'mina' },
            { prompt: 'Say yapılan tepelere dokun.', term: 'safa-merve' },
          ],
          explanation: "Vakfe Arafat'ta, taş toplama Müzdelife'de, kurban Mina'da, say Safa ile Merve arasında yapılır.",
        },
        { kind: 'soru', questionId: 9353 },
        { kind: 'soru', questionId: 9354 },
        { kind: 'soru', questionId: 9357 },
        {
          kind: 'klasik',
          prompt: "Haccın üç farzını yazınız. Bu farzlardan hangisi Arafat'ta, hangisi Kâbe'de yapılır?",
          modelAnswer: "Haccın farzları ihrama girmek, Arafat'ta vakfe yapmak ve ziyaret tavafıdır. Vakfe Arafat'ta, ziyaret tavafı Kâbe'nin etrafında yapılır.",
        },
      ],
    },
  ],
};
