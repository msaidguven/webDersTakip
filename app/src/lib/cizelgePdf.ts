// Yazdırılabilir ay çizelgesinin PDF'i (A4 yatay), tarayıcıda pdf-lib ile üretilir. Düzen
// PrintableSheet ile aynı: Tarih | ders başına Doğru/Yanlış | Toplam. Türkçe karakterler için
// Noto Sans gömülür (public/fonts). Dersler boş bırakılır; öğrenci adları kendisi yazar.
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export const SUBJECT_SLOTS = 6;

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 28;
const DATE_W = 50;
const PAIR_W = 56;
const TOTAL_W = 60;
const HEADER_ROW_H = 20;
const SUBHEADER_ROW_H = 16;
const MAX_ROW_H = 18;
const INK = rgb(0.1, 0.1, 0.1);
const GRID = rgb(0.6, 0.6, 0.6);
const MUTED = rgb(0.45, 0.45, 0.45);

let fontsPromise: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;

async function fetchFont(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font yüklenemedi: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Hata olursa önbellek temizlenir ki bir sonraki denemede yeniden indirilsin.
function loadFonts() {
  fontsPromise ??= Promise.all([fetchFont('/fonts/NotoSans-Regular.ttf'), fetchFont('/fonts/NotoSans-Bold.ttf')])
    .then(([regular, bold]) => ({ regular, bold }))
    .catch((error) => {
      fontsPromise = null;
      throw error;
    });
  return fontsPromise;
}

function text(page: PDFPage, value: string, cx: number, cy: number, font: PDFFont, size: number, color = INK) {
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: cx - width / 2, y: cy - size * 0.35, size, font, color });
}

// Kutu yalnız kenarlıktır; birleşik hücreler (Tarih, Toplam, ders başlığı) büyük kutuyla çizilir.
function box(page: PDFPage, x: number, yTop: number, width: number, height: number) {
  page.drawRectangle({ x, y: yTop - height, width, height, borderColor: GRID, borderWidth: 0.6 });
}

export async function buildMonthlySheetPdf(title: string, days: number): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const pairsWidth = SUBJECT_SLOTS * 2 * PAIR_W;
  const tableW = DATE_W + pairsWidth + TOTAL_W;
  const x0 = (PAGE_W - tableW) / 2;
  const tableTop = PAGE_H - 62;
  const headerH = HEADER_ROW_H + SUBHEADER_ROW_H;

  text(page, title, PAGE_W / 2, PAGE_H - 34, bold, 14);

  box(page, x0, tableTop, DATE_W, headerH);
  text(page, 'Tarih', x0 + DATE_W / 2, tableTop - headerH / 2, bold, 8);

  let x = x0 + DATE_W;
  for (let i = 0; i < SUBJECT_SLOTS; i++) {
    box(page, x, tableTop, 2 * PAIR_W, HEADER_ROW_H);
    box(page, x, tableTop - HEADER_ROW_H, PAIR_W, SUBHEADER_ROW_H);
    box(page, x + PAIR_W, tableTop - HEADER_ROW_H, PAIR_W, SUBHEADER_ROW_H);
    const subY = tableTop - HEADER_ROW_H - SUBHEADER_ROW_H / 2;
    text(page, 'Doğru', x + PAIR_W / 2, subY, regular, 7.5);
    text(page, 'Yanlış', x + PAIR_W * 1.5, subY, regular, 7.5);
    x += 2 * PAIR_W;
  }

  box(page, x, tableTop, TOTAL_W, headerH);
  text(page, 'Toplam', x + TOTAL_W / 2, tableTop - headerH / 2, bold, 8);

  const bodyTop = tableTop - headerH;
  const rowH = Math.min(MAX_ROW_H, (bodyTop - 36) / days);
  for (let d = 1; d <= days; d++) {
    const top = bodyTop - (d - 1) * rowH;
    box(page, x0, top, DATE_W, rowH);
    text(page, String(d), x0 + DATE_W / 2, top - rowH / 2, regular, 8);
    for (let j = 0; j < SUBJECT_SLOTS * 2; j++) {
      box(page, x0 + DATE_W + j * PAIR_W, top, PAIR_W, rowH);
    }
    box(page, x0 + DATE_W + pairsWidth, top, TOTAL_W, rowH);
  }

  const brand = 'derstakip.net';
  const brandW = regular.widthOfTextAtSize(brand, 8);
  page.drawText(brand, { x: PAGE_W - MARGIN - brandW, y: 14, size: 8, font: regular, color: MUTED });

  return pdf.save();
}
