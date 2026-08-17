// app/src/lib/yillikPlan/docxParser.ts
// Yıllık plan DOCX tablosunu okuyup yapılandırılmış satırlara çevirir.
// Python tarafındaki yillik_plan/docx_parser.py'nin (python-docx tabanlı) birebir
// TypeScript portu — aynı sütun tespiti, hücre okuma ve gruplama mantığını kullanır,
// ancak DOCX'in ham OOXML'ini (word/document.xml) doğrudan JSZip + DOM ile okur.
//
// python-docx'in `Table.rows[i].cells` erişimi, gridSpan (yatay birleşim) ve vMerge
// (dikey birleşim) hücrelerini otomatik olarak "kaynak hücre" içeriğiyle doldurur;
// MEB yıllık plan şablonlarında Ünite sütunu genelde birden fazla haftayı kapsayan
// dikey birleşik hücre olduğu için bu davranış burada da (buildCellGrid) replike edilir.

import JSZip from 'jszip';
import { DOMParser, type Element } from '@xmldom/xmldom';

export type ParsedRow = {
  week_no: number | null;
  Hafta: string;
  ünite: string;
  konu: string;
  kazanım: string[];
  saat: number | null;
};

const SEP = '§§';

const KOD_RE = /^(SB|BTY|BT|FEN|FEB?|MAT|TDE?|İNG|MÜZ|GÖR|BED|DİN|AHL?|TAR|COĞ|FEL|PSİ|SOSYOLOJİ|REH)\.\d+\.\d*\.?\d*\.?\s*(\(.+\))?\s*$/i;
const TATIL = ['Tatil', 'tatil', 'Bayram', 'bayram', 'Yıl Sonu', 'yıl sonu', 'Sınav'];
const KUCUK: Record<string, string> = { İ: 'i', I: 'ı', Ş: 'ş', Ğ: 'ğ', Ü: 'ü', Ö: 'ö', Ç: 'ç' };
const BUYUK: Record<string, string> = { i: 'İ', ı: 'I', ş: 'Ş', ğ: 'Ğ', ü: 'Ü', ö: 'Ö', ç: 'Ç' };

const KOLON_ADAYLARI: Record<string, string[]> = {
  tarih: ['TARİH', 'DATE'],
  hafta: ['HAFTA', 'WEEK'],
  saat: ['SAAT', 'DERS SAATİ', 'SÜRE', 'DERS SAATI'],
  unite: ['ÜNİTE', 'UNITE', 'ÜNİTE ADI', 'ALAN', 'ÖĞRENME ALANI'],
  konu: ['KONU', 'İÇERİK', 'KONU ADI', 'ALT ÖĞRENME'],
  kazanim: ['KAZANIM', 'KAZANIMLAR', 'SÜREÇ VE AÇIKLAMA', 'SÜREÇ AÇIKLAMA', 'SÜREÇ', 'AÇIKLAMA', 'HEDEF'],
};

// ── DOM yardımcıları ────────────────────────────────────────────────────────────

function directChildren(el: Element, tag: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === 1 && (n as Element).tagName === tag) out.push(n as Element);
  }
  return out;
}

function directChild(el: Element, tag: string): Element | null {
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i];
    if (n.nodeType === 1 && (n as Element).tagName === tag) return n as Element;
  }
  return null;
}

function runText(r: Element): string {
  let out = '';
  for (let i = 0; i < r.childNodes.length; i++) {
    const n = r.childNodes[i];
    if (n.nodeType !== 1) continue;
    const el = n as Element;
    if (el.tagName === 'w:t') out += el.textContent || '';
    else if (el.tagName === 'w:tab') out += '\t';
    else if (el.tagName === 'w:br' || el.tagName === 'w:cr') out += '\n';
  }
  return out;
}

// python-docx Cell.text: paragraflar "\n" ile birleştirilir, her paragraf içindeki
// run'lar doğrudan (aralarına bir şey eklenmeden) birleştirilir.
function cellPlainText(tc: Element): string {
  const paragraphs = directChildren(tc, 'w:p');
  return paragraphs
    .map((p) => {
      const runs = p.getElementsByTagName('w:r');
      let out = '';
      for (let i = 0; i < runs.length; i++) out += runText(runs[i]);
      return out;
    })
    .join('\n');
}

// docx_parser.py:_hucre_oku — hücredeki TÜM run'ları (paragraf sınırı gözetmeksizin)
// dolaşır; bir run'da w:br varsa ve run'un kendi metni boşsa "§§" (grup ayracı),
// doluysa "\n"+metin eklenir; w:br yoksa metin direkt eklenir.
function hucreOku(tc: Element): string {
  let buf = '';
  const runs = tc.getElementsByTagName('w:r');
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    const br = directChild(r, 'w:br');
    const tel = directChild(r, 'w:t');
    const txt = tel ? tel.textContent || '' : '';
    if (br) {
      buf += txt.trim() ? '\n' + txt : SEP;
    } else {
      buf += txt;
    }
  }
  return buf;
}

function surecBol(text: string): string[][] {
  const gruplar: string[][] = [];
  let simdiki: string[] = [];
  let sonHarf: string | null = null;
  for (const raw of text.split(SEP)) {
    const p = raw.trim();
    if (!p) continue;
    if (KOD_RE.test(p)) {
      if (simdiki.length) gruplar.push(simdiki);
      simdiki = [];
      sonHarf = null;
    } else {
      const satirlar = p.split('\n').map((s) => s.trim()).filter(Boolean);
      for (const satir of satirlar) {
        const m = /^([a-zçğıöşü])\)/i.exec(satir);
        if (m) {
          const harf = m[1].toLowerCase();
          if (harf === 'a' && sonHarf !== null && sonHarf !== 'a') {
            if (simdiki.length) gruplar.push(simdiki);
            simdiki = [];
          }
          sonHarf = harf;
        }
        simdiki.push(satir);
      }
    }
  }
  if (simdiki.length) gruplar.push(simdiki);
  return gruplar;
}

function alanListesi(tc: Element): string[] {
  const text = hucreOku(tc).replace(/\*Sınav Haftası/g, '').trim();
  return text
    .split(new RegExp(`\\n|${SEP}`))
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

// Python sürümünde yoktu — konu hücresinin ilk satırı bazen kazanım kodunun kendisiyle
// başlıyor (ör. "FB.5.1.1.Gökyüzündeki Komşumuz: Güneş"); alanTemizle'deki gibi genel
// (satır içi her yerde eşleşen) değil, SADECE baştaki kodu siliyoruz — konu başlıkları
// alanlardan daha uzun/betimleyici olduğu için ortasında yanlışlıkla bir şey silmemek için.
const KONU_KOD_PREFIX_RE = /^[A-ZÇĞİÖŞÜa-zçğışöü0-9]+\.\d+(\.\d+)*\.?\s*/;

function icerikListesi(tc: Element): string[] {
  const result: string[] = [];
  for (const gRaw of hucreOku(tc).split(SEP)) {
    const g = gRaw.trim();
    if (!g) continue;
    let ilk = (g.split('\n')[0] || '').trim().replace(/^>+/, '').trim();
    ilk = ilk.replace(KONU_KOD_PREFIX_RE, '').trim();
    if (ilk) result.push(ilk);
  }
  return result;
}

function tcLower(c: string): string {
  return KUCUK[c] ?? c.toLowerCase();
}
function tcUpper(c: string): string {
  return BUYUK[c] ?? c.toUpperCase();
}
function tcTitle(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => tcUpper(tcLower(w[0])) + w.slice(1).split('').map(tcLower).join(''))
    .join(' ');
}

function alanTemizle(s: string): string {
  let temiz = s.replace(/[A-ZÇĞİÖŞÜa-zçğışöü0-9]+\.\d+(\.\d+)*\.?\s*/g, '').trim();
  temiz = (temiz.split('\n')[0] || '').trim();
  return temiz ? tcTitle(temiz) : tcTitle((s.split('\n')[0] || '').trim());
}

function tatilMi(cells: string[]): boolean {
  if (!cells.length) return false;
  const ilk = cells[0];
  return cells.every((c) => c === ilk) && TATIL.some((a) => ilk.includes(a));
}

function saatOku(metin: string): number | null {
  const m = /(\d+)/.exec(metin);
  return m ? parseInt(m[1], 10) : null;
}

function kolonHaritasi(headers: string[]): Record<string, number | null> {
  const upper = headers.map((h) => h.trim().toLocaleUpperCase('tr'));
  const sonuc: Record<string, number | null> = {};
  for (const [alan, adaylar] of Object.entries(KOLON_ADAYLARI)) {
    let idx: number | null = null;
    for (let i = 0; i < upper.length; i++) {
      if (adaylar.some((aday) => upper[i].includes(aday))) {
        idx = i;
        break;
      }
    }
    sonuc[alan] = idx;
  }
  return sonuc;
}

// ── Tablo grid çözümleme (gridSpan + vMerge) ────────────────────────────────────
// python-docx'in Table.rows[i].cells davranışını replike eder: yatay birleşimde
// (gridSpan) aynı hücre N sütuna, dikey birleşimde (vMerge devamı) aynı hücre
// kaynağın başladığı satırdan itibaren tüm devam satırlarına yayılır.

function buildCellGrid(table: Element): Element[][] {
  const rows = directChildren(table, 'w:tr');
  const grid: Element[][] = [];
  const openVMerge = new Map<number, Element>();

  for (const row of rows) {
    const cells = directChildren(row, 'w:tc');
    const rowGrid: Element[] = [];
    let col = 0;

    for (const tc of cells) {
      const tcPr = directChild(tc, 'w:tcPr');
      const gridSpanEl = tcPr ? directChild(tcPr, 'w:gridSpan') : null;
      const span = gridSpanEl ? parseInt(gridSpanEl.getAttribute('w:val') || '1', 10) || 1 : 1;
      const vMergeEl = tcPr ? directChild(tcPr, 'w:vMerge') : null;

      let sourceCell = tc;
      if (vMergeEl) {
        const val = vMergeEl.getAttribute('w:val');
        if (val === 'restart') {
          openVMerge.set(col, tc);
        } else {
          sourceCell = openVMerge.get(col) ?? tc;
        }
      } else {
        openVMerge.delete(col);
      }

      for (let k = 0; k < span; k++) {
        rowGrid[col] = sourceCell;
        col++;
      }
    }
    grid.push(rowGrid);
  }
  return grid;
}

// ── Ana fonksiyon ─────────────────────────────────────────────────────────────

export async function docxBufferToJson(buffer: Buffer | ArrayBuffer): Promise<ParsedRow[]> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('Geçersiz DOCX: word/document.xml bulunamadı.');
  }
  const xml = await documentXmlFile.async('string');
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  const table = doc.getElementsByTagName('w:tbl')[0];
  if (!table) {
    throw new Error('DOCX içinde tablo bulunamadı.');
  }

  const grid = buildCellGrid(table);
  if (!grid.length) {
    throw new Error('DOCX içinde tablo bulunamadı.');
  }

  const baslikCells = grid[0].map((tc) => cellPlainText(tc));
  const kolon = kolonHaritasi(baslikCells);
  if (kolon.hafta == null) kolon.hafta = 1;
  if (kolon.tarih == null) kolon.tarih = 0;
  if (kolon.unite == null) kolon.unite = 3;
  if (kolon.konu == null) kolon.konu = 4;
  if (kolon.kazanim == null) kolon.kazanim = 6;

  const sonuc: ParsedRow[] = [];

  for (let i = 1; i < grid.length; i++) {
    const rowGrid = grid[i];
    const cells = rowGrid.map((tc) => cellPlainText(tc));
    if (tatilMi(cells)) continue;

    const tarih = kolon.tarih! < cells.length ? cells[kolon.tarih!].trim() : '';
    const haftaS = kolon.hafta! < cells.length ? cells[kolon.hafta!].trim() : '';
    const hafta = tarih ? `${haftaS} (${tarih})` : haftaS;
    const weekMatch = /(\d+)/.exec(haftaS);
    const weekNo = weekMatch ? parseInt(weekMatch[1], 10) : null;

    let saat: number | null = null;
    if (kolon.saat != null && kolon.saat < cells.length) {
      saat = saatOku(cells[kolon.saat]);
    }

    const uniteTc = rowGrid[kolon.unite!];
    const konuTc = rowGrid[kolon.konu!];
    const kazanimTc = rowGrid[kolon.kazanim!];
    if (!uniteTc || !konuTc || !kazanimTc) continue;

    const alanlar = alanListesi(uniteTc);
    const icerikler = icerikListesi(konuTc);
    const surecG = surecBol(hucreOku(kazanimTc));

    const adet = Math.max(alanlar.length, icerikler.length, 1);
    for (let j = 0; j < adet; j++) {
      const unite = j < alanlar.length ? alanTemizle(alanlar[j]) : '';
      const konu = j < icerikler.length ? icerikler[j] : '';
      const kazan = j < surecG.length ? surecG[j] : [];
      if (!unite && !konu && !kazan.length) continue;
      sonuc.push({ week_no: weekNo, Hafta: hafta, ünite: unite, konu, kazanım: kazan, saat });
    }
  }

  // Boş ünite/saat → aynı haftanın önceki satırından devral
  for (let idx = 1; idx < sonuc.length; idx++) {
    if (!sonuc[idx].ünite && sonuc[idx].Hafta === sonuc[idx - 1].Hafta) {
      sonuc[idx].ünite = sonuc[idx - 1].ünite;
    }
    if (sonuc[idx].saat == null && sonuc[idx].Hafta === sonuc[idx - 1].Hafta) {
      sonuc[idx].saat = sonuc[idx - 1].saat;
    }
  }

  return sonuc;
}
