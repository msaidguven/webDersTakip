import { extractText, getDocumentProxy } from 'unpdf';

export type PdfExtractResult = { text: string; pageCount: number };

// unpdf, pdfjs-dist'i serverless/Node ortamlarında fs bağımlılığı olmadan
// çalıştırıyor; bu yüzden Vercel function'ları içinde güvenli.
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });

  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!normalized) {
    throw new Error('PDF içinden metin çıkarılamadı (taranmış görsel olabilir)');
  }

  return { text: normalized, pageCount: totalPages };
}
