// Öğretmenin hazırladığı yazılı kağıdının düzenlenebilir Word hâli (paperPdfHtml.ts ile aynı düzen):
// başlık + okul + öğrenci bilgi tablosu, puanlı sorular ve zorluğa göre cevap boşluğu, imza; yeni
// sayfada cevap anahtarı (cevap, puanlama ölçütü, anahtar kavramlar). Matematik düz metne çevrilir.
import 'server-only';
import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, SectionType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import { latexToPlain } from '@/app/src/lib/latexToPlain';
import { svgToImageRun } from '@/app/src/lib/svgToDocxImage';
import type { PaperRequest } from '@/app/src/lib/yazili/teacher';

const FONT = 'Arial';
const answerLines = (difficulty: number | null) => ((difficulty ?? 3) <= 2 ? 4 : (difficulty ?? 3) >= 4 ? 7 : 5);
const run = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? 22, bold: opts.bold, italics: opts.italics });

function studentTable(): Table {
  const border = { style: BorderStyle.SINGLE, size: 8, color: '000000' };
  const cell = (label: string, pct: number) =>
    new TableCell({
      width: { size: pct, type: WidthType.PERCENTAGE },
      borders: { top: border, bottom: border, left: border, right: border },
      children: [new Paragraph({ spacing: { before: 60, after: 260 }, children: [run(label, { size: 19 })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [cell('Adı Soyadı:', 34), cell('Numarası:', 20), cell('Sınıfı / Şubesi:', 26), cell('Puan:', 20)] })],
  });
}

// İki sütunda görsel sütun genişliğine sığar (svgToDocxImage: Word px, 96 dpi).
const imageBox = (columns: 1 | 2) => ({ maxWidth: columns === 2 ? 320 : 620, maxHeight: 208 });

function questionParagraphs(item: PaperRequest['items'][number], no: number, columns: 1 | 2): Paragraph[] {
  const { question: q, points } = item;
  const image = q.svgContent ? svgToImageRun(q.svgContent, imageBox(columns), `${no}. soru görseli`) : null;
  const imagePara = image ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [image] })] : [];
  return [
    ...(q.svgPosition === 'above' ? imagePara : []),
    new Paragraph({
      spacing: { before: 200 },
      keepNext: true,
      children: [run(`${no}. `, { bold: true }), run(latexToPlain(q.text)), run(`  (${points} puan)`, { bold: true, size: 19 })],
    }),
    ...(q.svgPosition === 'below' ? imagePara : []),
    ...Array.from({ length: answerLines(q.difficulty) }, () => new Paragraph({ spacing: { before: 120 }, children: [run('')] })),
  ];
}

// Cevap görseli (çizim isteyen sorular): cevap anahtarında Cevap satırının altında.
function answerImageParagraph(svg: string | null): Paragraph[] {
  const image = svg ? svgToImageRun(svg, undefined, 'Cevap görseli') : null;
  return image ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [image] })] : [];
}

function keyParagraphs(item: PaperRequest['items'][number], no: number): Paragraph[] {
  const { question: q, points } = item;
  return [
    new Paragraph({ spacing: { before: 220 }, keepNext: true, children: [run(`${no}. `, { bold: true }), run(latexToPlain(q.text), { bold: true }), run(`  (${points} puan)`, { size: 19 })] }),
    new Paragraph({ spacing: { before: 60 }, children: [run('Cevap: ', { bold: true }), run(latexToPlain(q.modelAnswer))] }),
    ...answerImageParagraph(q.answerSvgContent),
    ...(q.rubric
      ? q.rubric.split('\n').filter(Boolean).map((line, i) => new Paragraph({ spacing: { before: 40 }, children: [...(i === 0 ? [run('Puanlama: ', { bold: true, size: 20 })] : []), run(latexToPlain(line), { size: 20 })] }))
      : []),
    ...(q.keyTerms.length ? [new Paragraph({ spacing: { before: 40 }, children: [run('Anahtar kavramlar: ', { bold: true, size: 20 }), run(q.keyTerms.join(', '), { italics: true, size: 20 })] })] : []),
  ];
}

export async function buildPaperDocx(req: PaperRequest): Promise<Buffer> {
  const center = (children: TextRun[], before = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before }, children });
  // Üç bölüm: başlık + öğrenci tablosu (tam genişlik) → sorular (aynı sayfada, seçilen sütun sayısı) → yeni
  // sayfada tek sütun cevap anahtarı.
  const header: (Paragraph | Table)[] = [
    center([run('2026-2027 EĞİTİM-ÖĞRETİM YILI', { size: 19 })]),
    center([run(req.school ? req.school.toLocaleUpperCase('tr') : 'Okul: ....................................................................', { bold: !!req.school })], 60),
    center([run(req.title.toLocaleUpperCase('tr'), { bold: true, size: 25 })], 60),
    new Paragraph({ spacing: { after: 60 }, children: [] }),
    studentTable(),
    new Paragraph({ spacing: { before: 120 }, children: [run('Soruları dikkatlice okuyunuz. Cevaplarınızı soruların altındaki boşluğa yazınız. Süre bir ders saatidir.', { italics: true, size: 18 })] }),
  ];
  const questions: Paragraph[] = [
    ...req.items.flatMap((item, i) => questionParagraphs(item, i + 1, req.columns)),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 280 },
      children: [run('Başarılar dilerim.'), ...(req.teacherName ? [new TextRun({ break: 1 }), run(req.teacherName, { bold: true }), new TextRun({ break: 1 }), run('Ders Öğretmeni')] : [])],
    }),
  ];
  const key: Paragraph[] = [
    center([run(`${req.title.toLocaleUpperCase('tr')} — CEVAP ANAHTARI`, { bold: true, size: 24 })]),
    ...req.items.flatMap((item, i) => keyParagraphs(item, i + 1)),
  ];

  const page = { margin: { top: 680, bottom: 680, left: 720, right: 720 } };
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [
      { properties: { page }, children: header },
      {
        properties: { page, type: SectionType.CONTINUOUS, column: { count: req.columns, space: 400, separate: req.columns === 2 } },
        children: questions,
      },
      { properties: { page, type: SectionType.NEXT_PAGE }, children: key },
    ],
  });
  return Packer.toBuffer(doc);
}
