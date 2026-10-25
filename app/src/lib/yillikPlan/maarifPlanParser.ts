// app/src/lib/yillikPlan/maarifPlanParser.ts
// Maarif Modeli (TYMM) yıllık plan DOCX'lerini okur: her ünite/tema için bir "BİLGİ TABLOSU"
// + bir hafta tablosu (TARİH | HAFTA | SAAT | TEMA | İÇERİK ÇERÇEVESİ | ÖĞRENME ÇIKTILARI |
// SÜREÇ BİLEŞENLERİ | …). docxParser.ts'ten farkı: konu/sıra tahmini YOK — her süreç bileşeni
// dosyada kendi öğrenme çıktısı koduyla ("FB.6.1.2.a)") yazıldığı için (kod, harf) → haftalar
// haritası doğrudan çıkıyor; DB eşleştirmesi de bu anahtarla yapılıyor (matchMaarifPlan.ts).
//
// Dosyalarda görülen iki düzensizlik tolere ediliyor (2026-09-28, 6. sınıf Fen + Bilişim):
//  - Haftada tek öğrenme çıktısı varsa bileşenler kodsuz ("a) …") — kod o haftanın ÖĞRENME
//    ÇIKTILARI sütunundaki ilk koddan alınır.
//  - Kodda nokta eksik olabiliyor ("BTY6.6.3.") — normalize edilir ("BTY.6.6.3").
//
// İkinci şablon (2026-10-03, 5. sınıf Din Kültürü): tek tablo, üstte grup başlık satırı,
// bileşen sütunu "SÜREÇ BECERİLERİ" ve harfler aynı satırda yan yana ("a) … b) …") — satırlar
// harf işaretlerinden bölünerek aynı akışa sokulur; hücre metni tırnaklı olabiliyor.
// Tatil/okul temelli planlama haftalarında kod olmadığı için kendiliğinden atlanır.

import JSZip from 'jszip';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { buildCellGrid, cellPlainText } from './docxParser';

export type MaarifLearningOutcome = { code: string; title: string; weeks: number[] };
export type MaarifComponent = { code: string; letter: string; text: string; weeks: number[] };
export type MaarifPlan = {
  /** Kodlardaki sınıf numarası (FB.6.1.2 → 6); kodlar farklı sınıflara aitse null. */
  gradeNo: number | null;
  learningOutcomes: MaarifLearningOutcome[];
  components: MaarifComponent[];
  weekCount: number;
  /** Kodsuz ders haftaları (öğretim haftası numarasıyla), ör. { week: 18, label: 'OKUL TEMELLİ PLANLAMA' }. */
  nonContentWeeks: { week: number; label: string }[];
};

const LETTER_ORDER = 'abcçdefgğhıijklmnoöprsştuüvyz';
const CODE_SRC = '([A-ZÇĞİÖŞÜ]{2,5})\\.?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{1,2})\\.?';
const CODE_GLOBAL_RE = new RegExp(CODE_SRC, 'g');
const COMPONENT_LINE_RE = new RegExp(`^(?:${CODE_SRC}\\s*)?([a-zçğıöşü])\\)\\s*(.*)$`);
const BARE_CODE_LINE_RE = new RegExp(`^${CODE_SRC}\\s*(?:\\([^)]*\\))?\\s*$`);
// Aynı satırdaki "… gözlem yapar. b) …" ayrımı: boşluktan sonra (isteğe bağlı kodlu) tek harf + ")"
const INLINE_COMPONENT_SPLIT_RE = new RegExp(`\\s+(?=(?:${CODE_SRC.replace(/\((?!\?)/g, '(?:')}\\s*)?[a-zçğıöşü]\\))`);
const WEEK_RE = /^(\d{1,2})\s*\.?\s*HAFTA/i;
// Başlığa yapışan notlar: "(2 Saat)", "*Okul Temelli Planlama"
const TITLE_NOISE_RE = /\(\d+\s*Saat\)|\*[^\n]*/gi;
// Bazı şablonlarda hücre metni tırnak içinde ("a) … b) …") — baştaki/sondaki tırnaklar atılır
const stripQuotes = (s: string) => s.trim().replace(/^["“”„]+|["“”„]+$/g, '').trim();

const normCode = (m: RegExpExecArray | RegExpMatchArray, offset = 1) => `${m[offset]}.${m[offset + 1]}.${m[offset + 2]}.${m[offset + 3]}`;
const upperTr = (s: string) => s.toLocaleUpperCase('tr');

export function compareCodes(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  if (pa[0] !== pb[0]) return pa[0] < pb[0] ? -1 : 1;
  for (let i = 1; i < 4; i++) {
    const d = Number(pa[i]) - Number(pb[i]);
    if (d) return d;
  }
  return 0;
}

export function letterIndex(letter: string): number {
  const i = LETTER_ORDER.indexOf(letter);
  return i === -1 ? LETTER_ORDER.length : i;
}

type Columns = { week: number; lo: number; comp: number };

function findColumns(headerCells: string[]): Columns | null {
  const up = headerCells.map(upperTr);
  const week = up.findIndex((h) => h.trim() === 'HAFTA');
  const lo = up.findIndex((h) => h.includes('ÖĞRENME ÇIKTI'));
  const comp = up.findIndex((h, i) => i !== lo && (h.includes('SÜREÇ BİLEŞEN') || h.includes('SÜREÇ BECERİ')));
  return week >= 0 && lo >= 0 && comp >= 0 ? { week, lo, comp } : null;
}

// "FB.6.1.2. Başlık (2 Saat)FB.6.1.3. Başlık (2 Saat)" → [{code, title}]
function parseLearningOutcomeCell(text: string) {
  const matches = [...text.matchAll(CODE_GLOBAL_RE)];
  return matches.map((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const title = stripQuotes(text.slice(m.index! + m[0].length, end).replace(TITLE_NOISE_RE, '').replace(/\s+/g, ' '));
    return { code: normCode(m), title };
  });
}

export async function parseMaarifPlan(buffer: Buffer | ArrayBuffer): Promise<MaarifPlan | null> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return null;
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  const los = new Map<string, MaarifLearningOutcome>();
  const comps = new Map<string, MaarifComponent>();
  const weeks = new Set<number>();
  // Numaralı tatil satırları ("10. hafta | ARA TATİL"). Bazı şablonlar tatilleri de hafta sayıyor
  // (sosyal etkinlik 41. hafta), bazıları saymıyor (37. hafta). Site öğretim haftası kullanır
  // (tatil hafta tüketmez, 1–37): her hafta, kendinden önceki numaralı tatil sayısı kadar geri çekilir.
  const breakWeeks: number[] = [];
  const nonContentWeeks: { week: number; label: string }[] = [];
  const emptyComponentRows: { week: number; codes: string[] }[] = [];

  const tables = doc.getElementsByTagName('w:tbl');
  for (let t = 0; t < tables.length; t++) {
    const grid = buildCellGrid(tables[t] as Element);
    let cols: Columns | null = null;

    for (const rowGrid of grid) {
      const cells = rowGrid.map((tc) => (tc ? cellPlainText(tc) : ''));
      if (!cols) {
        cols = findColumns(cells);
        continue;
      }
      const weekMatch = WEEK_RE.exec((cells[cols.week] || '').trim());
      if (!weekMatch) continue;
      const week = Number(weekMatch[1]);

      const weekLos = parseLearningOutcomeCell(cells[cols.lo] || '');
      if (!weekLos.length) {
        if (upperTr(cells.join(' ')).includes('TATİL')) breakWeeks.push(week);
        else {
          // Kodsuz ders haftası (Okul Temelli Planlama, sosyal etkinlik): yalnız hata mesajında etiket olarak.
          const label = cells.slice(cols.week + 1).map((c) => c.replace(/\*/g, '').trim()).find((c) => c && !/^\d+\s*saat$/i.test(c));
          nonContentWeeks.push({ week, label: (label ?? '').split('\n')[0].slice(0, 60) });
        }
        continue;
      }
      for (const lo of weekLos) {
        const existing = los.get(lo.code);
        if (existing) {
          existing.weeks.push(week);
          if (lo.title.length > existing.title.length) existing.title = lo.title;
        } else {
          los.set(lo.code, { ...lo, weeks: [week] });
        }
      }
      if (weekLos.length) weeks.add(week);

      // Bir bileşenin metni satır kırılmasıyla bölünmüşse devam satırı yalnızca bu hücrede
      // İLK KEZ oluşturulan bileşene eklenir (önceki haftadan gelen tekrar metni çoğaltmasın).
      let current: string | null = weekLos[0]?.code ?? null;
      let appendTo: MaarifComponent | null = null;
      let anyComponent = false;
      const lines = (cells[cols.comp] || '').split('\n').flatMap((l) => l.split(INLINE_COMPONENT_SPLIT_RE));
      for (const rawLine of lines) {
        const line = stripQuotes(rawLine);
        if (!line) continue;
        const bare = BARE_CODE_LINE_RE.exec(line);
        if (bare) {
          current = normCode(bare);
          appendTo = null;
          continue;
        }
        const m = COMPONENT_LINE_RE.exec(line);
        if (!m) {
          if (appendTo && !line.startsWith('*')) appendTo.text = `${appendTo.text} ${line}`;
          continue;
        }
        if (m[1]) current = normCode(m, 1);
        if (!current) continue;
        anyComponent = true;
        const letter = m[5];
        const key = `${current}|${letter}`;
        const comp = comps.get(key);
        if (comp) {
          if (!comp.weeks.includes(week)) comp.weeks.push(week);
          appendTo = null;
        } else {
          appendTo = { code: current, letter, text: m[6].trim(), weeks: [week] };
          comps.set(key, appendTo);
        }
      }
      if (!anyComponent) emptyComponentRows.push({ week, codes: weekLos.map((lo) => lo.code) });
    }
  }

  if (!comps.size) return null;

  const toTeachingWeek = (w: number) => w - breakWeeks.filter((b) => b < w).length;
  const learningOutcomes = [...los.values()]
    .map((lo) => ({ ...lo, weeks: [...new Set(lo.weeks.map(toTeachingWeek))].sort((a, b) => a - b) }))
    .sort((a, b) => compareCodes(a.code, b.code));
  const components = [...comps.values()]
    .map((c) => ({ ...c, weeks: c.weeks.map(toTeachingWeek).sort((a, b) => a - b) }))
    .sort((a, b) => compareCodes(a.code, b.code) || letterIndex(a.letter) - letterIndex(b.letter));

  // Bileşen sütunu TAMAMEN boş hafta ("22. Hafta | SB.6.4.1 … | (boş)", 6. Sosyal): önceki haftanın
  // devamı — öğrenme çıktısının bir önceki (yoksa sonraki) haftasındaki bileşenlerine, o da yoksa
  // hepsine eklenir. Sütunda başka bir çıktının bileşeni varsa (geçiş haftası, 6. Mat 18. hafta:
  // MAT.6.5.1 + MAT.6.5.2, bileşenler yalnız 6.5.2) dosya haftayı açıkça vermiştir, dokunulmaz.
  for (const row of emptyComponentRows) {
    const w = toTeachingWeek(row.week);
    for (const code of row.codes) {
      const loComps = components.filter((c) => c.code === code);
      if (loComps.some((c) => c.weeks.includes(w))) continue;
      const targets = [w - 1, w + 1].map((n) => loComps.filter((c) => c.weeks.includes(n))).find((l) => l.length) ?? loComps;
      for (const c of targets) c.weeks = [...c.weeks, w].sort((a, b) => a - b);
    }
  }

  const gradeNos = new Set([...learningOutcomes.map((l) => l.code), ...components.map((c) => c.code)].map((c) => Number(c.split('.')[1])));

  return {
    gradeNo: gradeNos.size === 1 ? [...gradeNos][0] : null,
    learningOutcomes,
    components,
    weekCount: weeks.size,
    nonContentWeeks: nonContentWeeks.map((n) => ({ ...n, week: toTeachingWeek(n.week) })),
  };
}
