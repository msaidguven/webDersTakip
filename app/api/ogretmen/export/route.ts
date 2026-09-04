import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from 'docx';
import { Resvg } from '@resvg/resvg-js';
import { requireTeacher } from '@/app/src/lib/teacherAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const MAX_QUESTIONS = 100;
const BLANK_LINES_PER_QUESTION = 4;
const SVG_RENDER_WIDTH = 420; // px — makul bir sayfa genişliği, docx px'i EMU'ya kendi çeviriyor

type ExportMode = 'questions' | 'answers' | 'both';

type QuestionRow = { id: number; question_text: string; svg_content: string | null; svg_position: 'above' | 'below' };
type ClassicalRow = { question_id: number; model_answer: string | null; key_terms: string[] };

function svgToImageRun(svg: string): ImageRun | null {
  try {
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: SVG_RENDER_WIDTH } });
    const rendered = resvg.render();
    return new ImageRun({
      type: 'png',
      data: rendered.asPng(),
      transformation: { width: rendered.width, height: rendered.height },
    });
  } catch {
    // Bozuk/desteklenmeyen bir SVG dokümanı bloke etmesin — o sorunun görseli
    // atlanır, metni yine de Word'e girer.
    return null;
  }
}

export async function POST(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher.ok) return teacher.response;

  const body = await request.json().catch(() => null) as { questionIds?: unknown; mode?: unknown } | null;
  const ids = Array.isArray(body?.questionIds)
    ? (body!.questionIds as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
    : [];
  const mode: ExportMode = body?.mode === 'answers' || body?.mode === 'both' ? body.mode : 'questions';

  if (!ids.length || ids.length > MAX_QUESTIONS) {
    return NextResponse.json({ error: `1-${MAX_QUESTIONS} arası soru seçilmeli` }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Sadece yayındaki (is_active) klasik sorular dışa aktarılabilir — taslak/onaysız
  // içerik öğretmenin eline hiç geçmemeli.
  const { data: questionRows, error } = await supabase
    .from('questions')
    .select('id, question_text, svg_content, svg_position')
    .in('id', ids)
    .eq('question_type_id', 4)
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questions = (questionRows as QuestionRow[] | null) || [];
  if (!questions.length) return NextResponse.json({ error: 'Seçili sorular bulunamadı' }, { status: 404 });

  const { data: classicalRows } = await supabase
    .from('question_classical')
    .select('question_id, model_answer, key_terms')
    .in('question_id', questions.map((q) => q.id));
  const answerByQuestion = new Map(((classicalRows as ClassicalRow[] | null) || []).map((r) => [r.question_id, r]));

  const children: (Paragraph)[] = [];

  const title = mode === 'answers' ? 'Cevap Anahtarı' : mode === 'both' ? 'Açık Uçlu Sorular ve Cevap Anahtarı' : 'Açık Uçlu Sorular';
  children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));

  if (mode === 'questions' || mode === 'both') {
    questions.forEach((q, idx) => {
      const image = q.svg_content ? svgToImageRun(q.svg_content) : null;
      if (image && q.svg_position !== 'below') {
        children.push(new Paragraph({ children: [image], alignment: AlignmentType.CENTER }));
      }
      children.push(new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: `${idx + 1}. ${q.question_text}`, bold: true })],
      }));
      if (image && q.svg_position === 'below') {
        children.push(new Paragraph({ children: [image], alignment: AlignmentType.CENTER }));
      }
      for (let i = 0; i < BLANK_LINES_PER_QUESTION; i++) {
        children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun('')] }));
      }
    });
  }

  if (mode === 'answers' || mode === 'both') {
    if (mode === 'both') children.push(new Paragraph({ text: 'Cevap Anahtarı', heading: HeadingLevel.HEADING_1, spacing: { before: 480 } }));
    questions.forEach((q, idx) => {
      const answer = answerByQuestion.get(q.id);
      children.push(new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: `${idx + 1}. `, bold: true }), new TextRun({ text: q.question_text, bold: true })],
      }));
      children.push(new Paragraph({ children: [new TextRun(answer?.model_answer || '(cevap anahtarı girilmemiş)')] }));
      if (answer?.key_terms?.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Anahtar kavramlar: ${answer.key_terms.join(', ')}`, italics: true })] }));
      }
    });
  }

  const doc = new Document({ sections: [{ properties: {}, children }] });
  const buffer = await Packer.toBuffer(doc);

  const asciiName = mode === 'answers' ? 'cevap-anahtari.docx' : mode === 'both' ? 'sorular-ve-cevaplar.docx' : 'acik-uclu-sorular.docx';

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${asciiName}"`,
    },
  });
}
