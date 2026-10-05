// MEB öğretmen kılavuz kitabını (dijital PDF -> sayfa sayfa metin, bkz. unpdf extractText)
// konu bazlı ham bölümlere ayırır — AI'sız, deterministik. Kılavuzun yapısı (5-6. sınıf
// Bilişim kılavuzlarında doğrulandı, 2026-10-04):
//   tema kapağı -> tema genel bakışı (DERS SAATİ / İÇERİK ÇERÇEVESİ / ön değerlendirme)
//   -> ders planları ("Süre: N ders saati" + "Öğrenme Çıktı(ları)" + BTY.x.y.z kodu)
//   -> tema sonu (Farklılaştırma / Zenginleştirme / Destekleme / Ölçme ve Değerlendirme)
//   -> en sonda SÖZLÜK, KAYNAKÇA.
// Ders planı konuya ÖNCE öğrenme çıktısı koduyla (topic_learning_outcomes.code) bağlanır —
// kılavuzun başlığı bazen yanlış (5. sınıf s.198 "Bilgi Kaynakları..." başlığı altında
// BTY.5.6.1 algoritma dersi var), kod ise güvenilir. Kod yoksa/eşleşmezse başlıkla, o da
// yoksa önceki ders planının konusuyla (aynı konunun devam dersi) eşlenir. Bir ders planı
// birden fazla konuyu kapsayabilir (6. sınıf "Veri Analizi" planı BTY.6.2.2-6.2.4 = 3 konu).

export type GuideTopicInput = { id: number; title: string; learningOutcomeCodes: string[] };

export type GuideLessonBlock = {
  startPage: number;
  endPage: number;
  heading: string;
  hours: number | null;
  codes: string[];
  topicIds: number[];
  matchedBy: 'code' | 'title' | 'previous' | 'none';
};

export type GuideTopicSection = {
  topicId: number;
  pages: number[];
  // Konunun ders planlarındaki "Süre" toplamı; plan birden fazla konuyu kapsıyorsa eşit bölünür.
  hours: number | null;
  text: string;
};

export type GuideSplitResult = {
  blocks: GuideLessonBlock[];
  sections: GuideTopicSection[];
  glossaryText: string | null;
  unmatchedTopicIds: number[];
};

const THEME_END_HEADINGS = [
  'farklılaştırma',
  'zenginleştirme',
  'destekleme',
  'ölçme ve değerlendirme',
  'tema sonu',
  'bilgisayarlı sınıflar için',
  'bilgisayarsız sınıflar için',
];

function normalize(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/[âà]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[ûù]/g, 'u')
    .replace(/[^a-zçğıöşü0-9]+/g, ' ')
    .trim();
}

function contentLines(page: string): string[] {
  return page
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // Sayfa numarası, "5. SINIF" ve "N. TEMA: ..." üst bilgileri içerik değil.
    .filter((l) => !/^\d+$/.test(l) && !/^\d+\.\s*SINIF$/i.test(l) && !/^\d+\.\s*TEMA\s*:/i.test(l));
}

function isLessonStart(page: string): boolean {
  return /Süre\s*:?\s*\n?\s*\d+\s*ders saati/i.test(page) && /Öğrenme Çıktı/i.test(page);
}

function isThemeCover(page: string): boolean {
  const lines = page.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
  return lines.some((l) => /^\d+\.\s*TEMA$/i.test(l));
}

function isThemeOverview(page: string): boolean {
  return /DERS SAATİ/.test(page) && /ÇERÇEVESİ/.test(page);
}

function isBackMatter(page: string): boolean {
  const first = page.split('\n').map((l) => l.trim()).filter(Boolean)[0] || '';
  return /SÖZLÜK|KAYNAKÇA|HARİTA/i.test(first);
}

function isThemeEnd(page: string): boolean {
  const first = normalize(contentLines(page)[0] || '');
  return THEME_END_HEADINGS.some((h) => first.startsWith(h));
}

// "Süre:" satırından ÖNCEKİ büyük harfli satırlar ders planının başlığı.
function lessonHeading(page: string): string {
  const lines = contentLines(page);
  const idx = lines.findIndex((l) => /^Süre\b/i.test(l));
  const head = (idx === -1 ? [] : lines.slice(0, idx)).filter((l) => l === l.toLocaleUpperCase('tr') && /[A-ZÇĞİÖŞÜ]/.test(l));
  return head.join(' ').trim();
}

function lessonHours(page: string): number | null {
  const m = page.match(/Süre\s*:?\s*\n?\s*(\d+)\s*ders saati/i);
  return m ? Number(m[1]) : null;
}

// Kodlar yalnız ders planının üst kısmından (Dersten Önce'ye kadar) okunur — metnin içinde
// başka bir öğrenme çıktısına atıf varsa yanlış konuya bağlanmasın.
function lessonCodes(page: string): string[] {
  const cut = page.search(/Dersten Önce|Dikkat Çekme/);
  const head = cut === -1 ? page : page.slice(0, cut);
  return [...new Set(head.match(/[A-ZÇĞİÖŞÜ]{2,5}\.\d+\.\d+\.\d+/g) || [])];
}

export function splitGuideByTopic(pages: string[], topics: GuideTopicInput[]): GuideSplitResult {
  const topicsByCode = new Map<string, number[]>();
  for (const t of topics) {
    for (const code of t.learningOutcomeCodes) {
      const list = topicsByCode.get(code) || [];
      list.push(t.id);
      topicsByCode.set(code, list);
    }
  }
  const topicByTitle = new Map(topics.map((t) => [normalize(t.title), t.id]));

  // 1) Ders planı sınırları
  const blocks: GuideLessonBlock[] = [];
  let glossaryStart: number | null = null;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (glossaryStart == null && /^\s*\d*\s*SÖZLÜK/m.test(page.slice(0, 40))) glossaryStart = i;
    if (!isLessonStart(page)) continue;

    let end = i;
    for (let j = i + 1; j < pages.length; j++) {
      const p = pages[j];
      if (isLessonStart(p) || isThemeCover(p) || isThemeOverview(p) || isBackMatter(p) || isThemeEnd(p)) break;
      end = j;
    }

    const heading = lessonHeading(page);
    const codes = lessonCodes(page);
    let topicIds = [...new Set(codes.flatMap((c) => topicsByCode.get(c) || []))];
    let matchedBy: GuideLessonBlock['matchedBy'] = topicIds.length ? 'code' : 'none';
    if (!topicIds.length && heading) {
      const byTitle = topicByTitle.get(normalize(heading));
      if (byTitle != null) { topicIds = [byTitle]; matchedBy = 'title'; }
    }
    if (!topicIds.length && blocks.length) {
      const prev = blocks[blocks.length - 1];
      // Başlıksız devam dersi: önceki planla aynı konu. Başlık varsa ama eşleşmediyse
      // bilinmeyen bir konu — tahminle başka konuya yapıştırma.
      if (!heading && prev.topicIds.length) { topicIds = prev.topicIds; matchedBy = 'previous'; }
    }

    blocks.push({ startPage: i + 1, endPage: end + 1, heading, hours: lessonHours(page), codes, topicIds, matchedBy });
    i = end;
  }

  // 2) Konu bazlı birleştirme
  const sectionMap = new Map<number, { pages: number[]; hours: number | null; texts: string[] }>();
  for (const b of blocks) {
    for (const topicId of b.topicIds) {
      const s = sectionMap.get(topicId) || { pages: [], hours: null, texts: [] };
      for (let p = b.startPage; p <= b.endPage; p++) s.pages.push(p);
      if (b.hours != null) s.hours = (s.hours ?? 0) + b.hours / b.topicIds.length;
      s.texts.push(pages.slice(b.startPage - 1, b.endPage).join('\n\n'));
      sectionMap.set(topicId, s);
    }
  }

  const sections: GuideTopicSection[] = [...sectionMap.entries()].map(([topicId, s]) => ({
    topicId,
    pages: s.pages,
    hours: s.hours == null ? null : Math.round(s.hours * 10) / 10,
    text: s.texts.join('\n\n'),
  }));

  let glossaryText: string | null = null;
  if (glossaryStart != null) {
    const parts: string[] = [];
    for (let i = glossaryStart; i < pages.length && /SÖZLÜK/.test(pages[i].slice(0, 40)); i++) parts.push(pages[i]);
    glossaryText = parts.join('\n').trim() || null;
  }

  return {
    blocks,
    sections,
    glossaryText,
    unmatchedTopicIds: topics.filter((t) => !sectionMap.has(t.id)).map((t) => t.id),
  };
}

// Sayfa sınıflarını tek tek göstermek yerine "12-16, 29" gibi kısa aralık metni.
export function formatPageRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return ranges.join(', ');
}
