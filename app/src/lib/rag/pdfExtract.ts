import { getDocumentProxy } from 'unpdf';
import { PDFDocument } from 'pdf-lib';
import { uploadPdfForTranscription, transcribePdfBatch, transcribePdfBatchWithUnits, deleteGeminiFile } from './gemini';

export type PdfUnitInput = { id: number; title: string };
export type PdfTextSegment = { unitId: number | null; unitTitle: string | null; pageCount: number; text: string };
export type PdfExtractResult = { pageCount: number; segments: PdfTextSegment[] };

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

type TaggedPage = { page: number; unitTitle: string | null; content: string };

// transcribePdfBatchWithUnits'in ürettiği "### Sayfa N | ÜNİTE: ..." işaretli
// çıktıyı sayfa sayfa ayırır. "YOK" -> unitTitle null (ünite dışı/eşleşmeyen içerik).
const PAGE_TAG_RE = /^### Sayfa (\d+) \| ÜNİTE: (.+?)\s*$/gm;

function parseTaggedPages(raw: string): TaggedPage[] {
  const matches = [...raw.matchAll(PAGE_TAG_RE)];
  return matches.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? raw.length) : raw.length;
    const rawTitle = m[2].trim();
    return {
      page: Number(m[1]),
      unitTitle: rawTitle === 'YOK' ? null : rawTitle,
      content: raw.slice(start, end).trim(),
    };
  });
}

async function transcribePlain(buffer: Buffer, pageCount: number): Promise<PdfExtractResult> {
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
  if (!text) throw new Error('PDF içinden metin çıkarılamadı');
  return { pageCount, segments: [{ unitId: null, unitTitle: null, pageCount, text }] };
}

// PDF, pdfjs'in düz metin çıkarımı yerine Gemini'nin multimodal PDF anlayışıyla
// sayfa görüntüsü olarak okunuyor: pdfjs formülleri (kesir, üs, kök, denklem)
// ve şekil/tablo/grafik içeriğini kaybediyordu ya da bozuk karakter dizisine
// çeviriyordu — özellikle matematik/fen kitaplarında RAG cevaplarını
// güvenilmez kılıyordu. pdfjs sadece sayfa sayısını almak için kalıyor.
//
// units verilmişse (ders için ünite tanımlıysa) her sayfa hangi üniteye ait
// olduğuna göre otomatik etiketlenip ardışık aynı-ünite sayfalar tek bir
// segmente birleştiriliyor — admin artık NotebookLM'de olduğu gibi elle
// ünite ünite prompt sormak zorunda kalmıyor. Bir ünite, 50MB Storage sınırı
// yüzünden birden fazla PDF parçasına (ayrı upload'lara) dağılsa bile sorun
// değil: her parça kendi içinde etiketlenip aynı unit_id ile ayrı
// rag_documents satırları olarak kaydediliyor, aiQuestionDraftGen bunları
// unit_id üzerinden zaten birleştirip okuyor.
export async function extractPdfTextByUnit(buffer: Buffer, units: PdfUnitInput[]): Promise<PdfExtractResult> {
  const pageCount = await getPageCount(buffer);
  if (pageCount === 0) throw new Error('PDF sayfa içermiyor');

  if (units.length === 0) return transcribePlain(buffer, pageCount);

  const batches: { start: number; end: number }[] = [];
  for (let start = 1; start <= pageCount; start += PAGES_PER_BATCH) {
    batches.push({ start, end: Math.min(start + PAGES_PER_BATCH - 1, pageCount) });
  }

  const batchPages = await mapWithConcurrency(batches, MAX_CONCURRENT_BATCHES, async ({ start, end }) => {
    const subBuffer = await splitPdfPages(buffer, start, end);
    const file = await uploadPdfForTranscription(subBuffer, `pages-${start}-${end}.pdf`);
    try {
      const raw = await transcribePdfBatchWithUnits(file.uri, 'application/pdf', start, end, units);
      return parseTaggedPages(raw);
    } finally {
      void deleteGeminiFile(file.name);
    }
  });

  const allPages = batchPages.flat().sort((a, b) => a.page - b.page);
  if (allPages.length === 0) throw new Error('PDF içinden metin çıkarılamadı');

  const unitByTitle = new Map(units.map((u) => [u.title.trim().toLowerCase(), u.id]));

  const segments: PdfTextSegment[] = [];
  for (const page of allPages) {
    const unitId = page.unitTitle ? unitByTitle.get(page.unitTitle.trim().toLowerCase()) ?? null : null;
    const unitTitle = unitId != null ? page.unitTitle : null;
    const last = segments[segments.length - 1];
    if (last && last.unitId === unitId) {
      last.text += `\n\n${page.content}`;
      last.pageCount += 1;
    } else {
      segments.push({ unitId, unitTitle, pageCount: 1, text: page.content });
    }
  }

  return { pageCount, segments };
}
