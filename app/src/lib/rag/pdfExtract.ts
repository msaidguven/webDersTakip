import { getDocumentProxy } from 'unpdf';
import { PDFDocument } from 'pdf-lib';
import { uploadPdfForTranscription, transcribePdfBatch, deleteGeminiFile } from './gemini';

export type PdfExtractResult = { text: string; pageCount: number };

// Kitap tek seferde Gemini'ye gönderilmiyor çünkü çıktı token limiti büyük
// kitaplarda yetersiz kalabiliyor; ~20 sayfalık alt-PDF'lere bölünüp en fazla
// 3 tanesi eşzamanlı transkribe ediliyor.
const PAGES_PER_BATCH = 20;
const MAX_CONCURRENT_BATCHES = 3;

async function getPageCount(buffer: Buffer): Promise<number> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  return pdf.numPages;
}

async function splitPdfPages(buffer: Buffer, startPage: number, endPage: number): Promise<Buffer> {
  const source = await PDFDocument.load(buffer);
  const sub = await PDFDocument.create();
  const indices = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage - 1 + i);
  const copiedPages = await sub.copyPages(source, indices);
  copiedPages.forEach((page) => sub.addPage(page));
  return Buffer.from(await sub.save());
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// PDF, pdfjs'in düz metin çıkarımı yerine Gemini'nin multimodal PDF anlayışıyla
// sayfa görüntüsü olarak okunuyor: pdfjs formülleri (kesir, üs, kök, denklem)
// ve şekil/tablo/grafik içeriğini kaybediyordu ya da bozuk karakter dizisine
// çeviriyordu — özellikle matematik/fen kitaplarında RAG cevaplarını
// güvenilmez kılıyordu. pdfjs sadece sayfa sayısını almak için kalıyor.
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractResult> {
  const pageCount = await getPageCount(buffer);
  if (pageCount === 0) throw new Error('PDF sayfa içermiyor');

  const batches: { start: number; end: number }[] = [];
  for (let start = 1; start <= pageCount; start += PAGES_PER_BATCH) {
    batches.push({ start, end: Math.min(start + PAGES_PER_BATCH - 1, pageCount) });
  }

  const batchTexts = await mapWithConcurrency(batches, MAX_CONCURRENT_BATCHES, async ({ start, end }) => {
    const subBuffer = await splitPdfPages(buffer, start, end);
    const file = await uploadPdfForTranscription(subBuffer, `pages-${start}-${end}.pdf`);
    try {
      return await transcribePdfBatch(file.uri, 'application/pdf', start, end);
    } finally {
      void deleteGeminiFile(file.name);
    }
  });

  const text = batchTexts.join('\n\n').trim();
  if (!text) {
    throw new Error('PDF içinden metin çıkarılamadı');
  }

  return { text, pageCount };
}
