// app/src/lib/yillikPlan/xlsxParser.ts
// MEB "Taslak Çerçeve Yıllık Plan" Excel dosyalarını (TYMM'in resmi şablonu — SÜRE / ÜNİTE-
// TEMA-İÇERİK ÇERÇEVESİ / ÖĞRENME ÇIKTILARI VE SÜREÇ BİLEŞENLERİ sütun grupları) okuyup
// docxParser.ts ile AYNI ParsedRow[] şeklinde döner — böylece "Hafta Ata" akışındaki
// eşleştirme/atama mantığı (assignWeeksFromDocx.ts) hiç değişmeden XLSX kaynağıyla da çalışır
// (2026-09-10 kullanıcı talebi: kitapsız derslerde DOCX yerine topluluk kaynaklı bu Excel
// şablonunu kullanmak).
//
// DOCX'ten iki yapısal farkı var: (1) hücre birleşimleri w:vMerge değil XLSX'in kendi
// !merges listesiyle tutuluyor — SheetJS bunu otomatik doldurmuyor, aşağıda elle dolduruyoruz.
// (2) "Öğrenme Çıktıları" (kod+cümle) ile "Süreç Bileşenleri" (a/b/c listesi) DOCX'teki gibi
// TEK hücrede değil, İKİ AYRI sütunda — docxParser.ts'teki surecBol kod-satırını AYIRT ETMEK
// için kullanılıyordu, burada buna gerek yok çünkü sütun ayrımı zaten bunu bedavaya veriyor:
// kazanım listesi doğrudan "Süreç Bileşenleri" sütunundaki a)/b)/c) satırlarından kuruluyor
// (bkz. splitComponents — hücre içi satır kaydırmasından (Alt+Enter) doğan, harfle
// başlamayan devam satırlarını bir önceki bileşene birleştiriyor, aksi halde yarım cümleler
// ayrı birer "kazanım" gibi sayılırdı).

// 'xlsx' paketinin default export'u yok (sadece named export'lar) — `import XLSX from 'xlsx'`
// tsx/Node ile çalışıyor görünse de Next'in Turbopack production build'inde "Export default
// doesn't exist in target module" hatasıyla patlıyordu (2026-09-10, Vercel deploy hatası).
import { read as xlsxRead, utils as xlsxUtils, type WorkSheet, type Range } from 'xlsx';
import { type ParsedRow } from './docxParser';

export type SheetParseResult = { sheetName: string; rows: ParsedRow[] };

const HEADER_ADAYLARI: Record<string, string[]> = {
  hafta: ['HAFTA'],
  saat: ['DERS SAATİ', 'SAAT', 'SÜRE'],
  tema: ['TEMA', 'ÜNİTE'],
  icerik: ['İÇERİK ÇERÇEVESİ', 'İÇERİK', 'KONU'],
  ogrenmeCiktilari: ['ÖĞRENME ÇIKTILARI'],
  surecBilesenleri: ['SÜREÇ BİLEŞENLERİ', 'SÜREÇ'],
};

function normalizeHeader(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr');
}

// "...\r\n\r\n/\r\n\r\n..." gibi, kendi satırında TEK BAŞINA "/" olan bir ayraçla bölünmüş
// birden fazla değeri (bir haftaya birden fazla tema/konu düşmüşse) ayırır.
function splitBySlashLine(raw: string): string[] {
  return raw
    .split(/(?:\r?\n\s*)+\/(?:\s*\r?\n)+|^\s*\/\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Öğrenme Çıktıları / Süreç Bileşenleri sütunları, birden fazla öğrenme çıktısı varsa
// aralarında boş satırla (çift \n) ayrılıyor.
function splitByBlankLine(raw: string): string[] {
  return raw
    .split(/\r?\n\s*\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Bir süreç bileşeni grubunu ("a) ...\nb) ...\nc) ...") satır satır bileşenlere ayırır.
// Hücre içinde uzun bir cümle Alt+Enter ile kaydırılmışsa (ör. "b) ...yönleri ile ilgili
// çözümleme\nyapar.") devam satırı harf+")" ile BAŞLAMAZ — bu durumda yeni bir bileşen
// değil, bir öncekinin devamı sayılıp sona eklenir; aksi halde "yapar." gibi yarım bir
// cümle kendi başına ayrı bir kazanım gibi kaydedilirdi.
function splitComponents(raw: string): string[] {
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    if (out.length === 0 || /^[a-zçğıöşü]\)/i.test(line)) {
      out.push(line);
    } else {
      out[out.length - 1] = `${out[out.length - 1]} ${line}`;
    }
  }
  return out;
}

// MEB'in çerçeve plan şablonunda İKİ başlık satırı var: üstteki GRUP başlığı ("ÜNİTE/TEMA -
// İÇERİK ÇERÇEVESİ", "ÖĞRENME ÇIKTILARI VE SÜREÇ BİLEŞENLERİ" gibi birleştirilmiş, birden
// fazla alt sütunu kapsayan hücreler) ve asıl SÜTUN başlığı ("HAFTA", "TEMA" tek başına). Grup
// başlığı satırı da substring olarak "HAFTA" (BELİRLİ GÜN VE HAFTALAR) ve "TEMA" (ÜNİTE/TEMA...)
// içerdiğinden, TAM eşleşme (normalize edilmiş hücre === "HAFTA") aranmadan seçilirse yanlış
// satır (ve dolayısıyla yanlış sütun indeksleri) bulunuyordu — TAM eşleşme şart koşuluyor.
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const normalized = rows[i].map((c) => normalizeHeader(String(c ?? '')));
    if (normalized.includes('HAFTA') && normalized.some((c) => c === 'TEMA' || c === 'ÜNİTE')) {
      return i;
    }
  }
  return -1;
}

// Önce TAM eşleşme aranır (ör. "TEMA" tek başına); grup başlığı satırındaki gibi başka bir
// sütunun adı da aday kelimeyi İÇERİYORSA (ör. "BELİRLİ GÜN VE HAFTALAR" içinde "HAFTA" geçmesi)
// yanlış sütuna düşülmesin diye .includes() sadece tam eşleşme bulunamazsa devreye giriyor.
function columnIndex(headerRow: string[], candidates: string[]): number | null {
  const normalized = headerRow.map(normalizeHeader);
  for (let i = 0; i < normalized.length; i++) {
    if (candidates.includes(normalized[i])) return i;
  }
  for (let i = 0; i < normalized.length; i++) {
    if (candidates.some((c) => normalized[i].includes(c))) return i;
  }
  return null;
}

// SheetJS sheet_to_json(header:1), birleştirilmiş (merge) hücrelerde SADECE sol-üst
// (anchor) hücrede değer döner, kapsadığı diğer hücreleri boş bırakır — python-docx'in
// vMerge/gridSpan'ı otomatik doldurmasının aksine. buildCellGrid'deki (docxParser.ts)
// vMerge doldurma mantığının XLSX karşılığı: her merge aralığını anchor değeriyle dolduruyoruz.
function fillMerges(rows: string[][], merges: Range[]): void {
  for (const m of merges) {
    const anchor = rows[m.s.r]?.[m.s.c] ?? '';
    if (!anchor) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      if (!rows[r]) rows[r] = [];
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        rows[r][c] = anchor;
      }
    }
  }
}

function saatOku(metin: string): number | null {
  const m = /(\d+)/.exec(metin);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeForCompare(s: string): string {
  return s.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr');
}

// MEB'in taslak dosyasında bazen bir haftanın Süreç Bileşenleri hücresinin SON bir/iki grubu,
// bir sonraki haftanın hücresinin BAŞINDA harfiyen (kopyala-yapıştır kalıntısı olarak) tekrar
// ediyor — 6. sınıf BTY'de 10./11. hafta arasında görüldü (2026-09-10 kullanıcı bildirimi):
// 10. haftanın son grubu, farklı bir konu başlığıyla 11. haftada da aynen duruyor. Aynı konu
// başlığı iki haftaya yayılmışsa (ör. tek bir konu 2 haftada işleniyorsa) tekrar GERÇEK ve
// istenen bir durum — bu yüzden sadece metin eşleşmesi yetmiyor, konu başlıkları da HEM
// önceki haftanın o pozisyondaki konusuyla HEM de mevcut haftanın karşılık geleceği konusuyla
// karşılaştırılıyor: başlıklar aynıysa (gerçek çok haftalı konu devamı) dokunulmuyor, farklıysa
// (yanlışlıkla sızmış içerik) mevcut haftanın BAŞINDAN atılıyor.
function dropLeadingDuplicateGroups(
  currentGroups: string[],
  currentIcerikler: string[],
  prevGroups: string[],
  prevIcerikler: string[]
): string[] {
  const surplus = currentGroups.length - currentIcerikler.length;
  if (surplus <= 0 || prevGroups.length === 0) return currentGroups;

  // Eşleşen metin uzunluğu (k) surplus'tan BÜYÜK olabilir (ör. önceki haftanın son 2 grubu
  // aynen tekrar etmiş olabilir ama mevcut haftanın sadece 1 fazlası var) — arama uzunluğu
  // surplus ile sınırlanmamalı, sadece SONUÇTA kaç grubun atılacağı surplus ile sınırlanır.
  const maxOverlap = Math.min(prevGroups.length, currentGroups.length);
  for (let k = maxOverlap; k >= 1; k--) {
    const prevTail = prevGroups.slice(-k).map(normalizeForCompare);
    const curHead = currentGroups.slice(0, k).map(normalizeForCompare);
    if (!prevTail.every((t, idx) => t === curHead[idx])) continue;

    // Metin eşleşti — şimdi konu başlıklarının GERÇEKTEN aynı çok-haftalı konunun devamı mı
    // yoksa yanlışlıkla sızmış farklı bir konu mu olduğuna bakıyoruz. Hizalama GRUP indeksi
    // üzerinden yapılıyor (prevIcerikler.length değil) çünkü önceki haftanın da kendi fazlası
    // (orphan grubu) olabilir.
    const prevGroupStart = prevGroups.length - k;
    let looksLikeGenuineContinuation = true;
    for (let m = 0; m < k; m++) {
      const prevAbsIdx = prevGroupStart + m;
      const prevKonu = prevAbsIdx < prevIcerikler.length ? prevIcerikler[prevAbsIdx] : '';
      const curKonu = m < currentIcerikler.length ? currentIcerikler[m] : '';
      if (!prevKonu || !curKonu || normalizeForCompare(prevKonu) !== normalizeForCompare(curKonu)) {
        looksLikeGenuineContinuation = false;
        break;
      }
    }
    if (looksLikeGenuineContinuation) return currentGroups;
    return currentGroups.slice(Math.min(k, surplus));
  }
  return currentGroups;
}

function parseSheet(sheetName: string, sheet: WorkSheet): ParsedRow[] {
  const raw = xlsxUtils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', blankrows: true }) as unknown as string[][];
  const original = raw.map((r) => r.map((c) => (c == null ? '' : String(c))));
  const rows = original.map((r) => [...r]);
  fillMerges(rows, (sheet['!merges'] as Range[] | undefined) || []);

  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) return [];
  const header = rows[headerIdx];

  const col = {
    hafta: columnIndex(header, HEADER_ADAYLARI.hafta),
    saat: columnIndex(header, HEADER_ADAYLARI.saat),
    tema: columnIndex(header, HEADER_ADAYLARI.tema),
    icerik: columnIndex(header, HEADER_ADAYLARI.icerik),
    ogrenmeCiktilari: columnIndex(header, HEADER_ADAYLARI.ogrenmeCiktilari),
    surecBilesenleri: columnIndex(header, HEADER_ADAYLARI.surecBilesenleri),
  };
  if (col.hafta == null || col.tema == null) return [];

  const sonuc: ParsedRow[] = [];
  let prevSurecGruplari: string[] = [];
  let prevIcerikler: string[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const haftaRaw = (col.hafta != null ? r[col.hafta] : '') || '';
    const temaRaw = (col.tema != null ? r[col.tema] : '') || '';
    if (!haftaRaw.trim() || !temaRaw.trim()) continue; // tatil/okul-temelli/dip not satırları vb.

    // Bir HAFTA/TEMA, birden fazla FİZİKSEL satıra (kendi başına birer konu/kazanım grubu
    // taşıyan) dikey birleştirilmiş olabilir — fillMerges tüm bu satırlara AYNI hafta/tema
    // değerini yayıyor, ama İçerik Çerçevesi/Öğrenme Çıktıları/Süreç Bileşenleri sütunları
    // kendi İÇLERİNDE DAHA KÜÇÜK birleşimlere sahip olabiliyor. Bu satır, o daha küçük
    // birleşimin devamıysa (orijinal — doldurulmamış — hücresi boşsa) içeriği bir önceki
    // satırda zaten eklemişizdir, atlanmazsa aynı konu/kazanım iki kez eklenir.
    const origRow = original[i] || [];
    const hasOwnContent =
      (col.icerik != null && (origRow[col.icerik] || '').trim()) ||
      (col.ogrenmeCiktilari != null && (origRow[col.ogrenmeCiktilari] || '').trim()) ||
      (col.surecBilesenleri != null && (origRow[col.surecBilesenleri] || '').trim());
    if (!hasOwnContent) continue;

    const weekMatch = /(\d+)/.exec(haftaRaw);
    const weekNo = weekMatch ? parseInt(weekMatch[1], 10) : null;
    const hafta = haftaRaw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    const saat = col.saat != null ? saatOku(r[col.saat] || '') : null;

    const temalar = splitBySlashLine(temaRaw).map((t) => t.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim());
    const icerikler = col.icerik != null ? splitBySlashLine(r[col.icerik] || '') : [];
    const ogrenmeGruplari = col.ogrenmeCiktilari != null ? splitByBlankLine(r[col.ogrenmeCiktilari] || '') : [];
    const surecGruplariRaw = col.surecBilesenleri != null ? splitByBlankLine(r[col.surecBilesenleri] || '') : [];
    const surecGruplari = dropLeadingDuplicateGroups(surecGruplariRaw, icerikler, prevSurecGruplari, prevIcerikler);

    const adet = Math.max(temalar.length, icerikler.length, ogrenmeGruplari.length, surecGruplari.length, 1);

    for (let j = 0; j < adet; j++) {
      const unite = j < temalar.length ? temalar[j] : temalar[0] || '';
      const konu = j < icerikler.length ? icerikler[j] : '';
      const kazan = j < surecGruplari.length ? splitComponents(surecGruplari[j]) : [];
      if (!unite && !konu && !kazan.length) continue;
      sonuc.push({ week_no: weekNo, Hafta: hafta, ünite: unite, konu, kazanım: kazan, saat });
    }

    prevSurecGruplari = surecGruplariRaw;
    prevIcerikler = icerikler;
  }

  return sonuc;
}

export async function xlsxBufferToSheets(buffer: Buffer | ArrayBuffer): Promise<SheetParseResult[]> {
  const wb = xlsxRead(buffer, { type: 'buffer' });
  const results: SheetParseResult[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = parseSheet(sheetName, sheet);
    if (rows.length) results.push({ sheetName, rows });
  }
  return results;
}
