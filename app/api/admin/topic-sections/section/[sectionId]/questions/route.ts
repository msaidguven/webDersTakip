import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

interface Params {
  sectionId: string;
}

type QuestionType = 'multiple_choice' | 'blank' | 'matching';

type ParsedMultipleChoice = { kind: 'multiple_choice'; question_text: string; solution_text: string | null; choices: { text: string; is_correct: boolean }[] };
type ParsedBlank = { kind: 'blank'; question_text: string; solution_text: string | null; options: { text: string; is_correct: boolean }[] };
type ParsedMatching = { kind: 'matching'; pairs: { left_text: string; right_text: string }[] };
type ParsedQuestion = ParsedMultipleChoice | ParsedBlank | ParsedMatching;

function parseChoiceList(raw: unknown, min: number, max: number): { text: string; is_correct: boolean }[] | null {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) return null;
  const out: { text: string; is_correct: boolean }[] = [];
  for (const c of raw as { text?: unknown; is_correct?: unknown }[]) {
    if (typeof c.text !== 'string' || !c.text.trim()) return null;
    out.push({ text: c.text.trim(), is_correct: c.is_correct === true });
  }
  if (out.filter((c) => c.is_correct).length !== 1) return null;
  return out;
}

function parseQuestions(body: unknown): ParsedQuestion[] | null {
  const obj = body as { type?: unknown; questions?: unknown } | null;
  if (!obj || !Array.isArray(obj.questions) || !obj.questions.length || obj.questions.length > 20) return null;

  const defaultType: QuestionType = obj.type === 'blank' || obj.type === 'matching' ? obj.type : 'multiple_choice';
  const parsed: ParsedQuestion[] = [];

  for (const q of obj.questions as Record<string, unknown>[]) {
    const type: QuestionType =
      q.type === 'blank' || q.type === 'matching' || q.type === 'multiple_choice' ? q.type : defaultType;

    if (type === 'matching') {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2 || q.pairs.length > 10) return null;
      const pairs: { left_text: string; right_text: string }[] = [];
      for (const p of q.pairs as { left_text?: unknown; right_text?: unknown }[]) {
        if (typeof p.left_text !== 'string' || !p.left_text.trim()) return null;
        if (typeof p.right_text !== 'string' || !p.right_text.trim()) return null;
        pairs.push({ left_text: p.left_text.trim(), right_text: p.right_text.trim() });
      }
      parsed.push({ kind: 'matching', pairs });
      continue;
    }

    if (typeof q.question_text !== 'string' || !q.question_text.trim()) return null;
    const solution_text = typeof q.solution_text === 'string' && q.solution_text.trim() ? q.solution_text.trim() : null;

    if (type === 'blank') {
      const questionText = q.question_text.trim();
      const blankCount = (questionText.match(/_____/g) || []).length;
      if (blankCount !== 1) return null;
      const options = parseChoiceList(q.options, 2, 6);
      if (!options) return null;
      parsed.push({ kind: 'blank', question_text: questionText, solution_text, options });
      continue;
    }

    const choices = parseChoiceList(q.choices, 2, 6);
    if (!choices) return null;
    parsed.push({ kind: 'multiple_choice', question_text: q.question_text.trim(), solution_text, choices });
  }

  return parsed;
}

const TYPE_ID: Record<QuestionType, number> = { multiple_choice: 1, blank: 3, matching: 4 };
const INVALID_MESSAGE =
  'Geçersiz soru listesi (çoktan seçmeli: 2-6 şık ve tam 1 doğru; boşluk doldurma: metinde tam bir "_____" ve 2-6 seçenekten tam 1 doğru; eşleştirme: 2-10 çift, hepsi dolu)';

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null);
  const questions = parseQuestions(body);

  if (!questions) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: linkRows, error: linkError } = await supabase
    .from('topic_content_section_outcomes')
    .select('outcome_id')
    .eq('section_id', sectionId);

  if (linkError) {
    return NextResponse.json({ error: 'Alt başlık kazanımları okunamadı' }, { status: 500 });
  }

  const outcomeIds = ((linkRows as { outcome_id: number }[] | null) || []).map((r) => r.outcome_id);
  if (!outcomeIds.length) {
    return NextResponse.json({ error: 'Bu alt başlığa bağlı kazanım yok — önce alt başlık planını oluşturun' }, { status: 409 });
  }

  let savedCount = 0;

  for (const q of questions) {
    const questionText = q.kind === 'matching' ? 'Aşağıdaki kavramları doğru tanımlarıyla eşleştir.' : q.question_text;
    const solutionText = q.kind === 'matching' ? null : q.solution_text;

    const { data: questionRow, error: qError } = await supabase
      .from('questions')
      .insert({ question_type_id: TYPE_ID[q.kind], question_text: questionText, solution_text: solutionText })
      .select('id')
      .single();

    if (qError || !questionRow) {
      return NextResponse.json({ error: `Soru kaydedilemedi: ${questionText.slice(0, 40)}` }, { status: 500 });
    }

    const questionId = (questionRow as { id: number }).id;
    let detailError: { message: string } | null = null;

    if (q.kind === 'multiple_choice') {
      const { error } = await supabase
        .from('question_choices')
        .insert(q.choices.map((c) => ({ question_id: questionId, choice_text: c.text, is_correct: c.is_correct })));
      detailError = error;
    } else if (q.kind === 'blank') {
      const { error } = await supabase
        .from('question_blank_options')
        .insert(q.options.map((o, idx) => ({ question_id: questionId, option_text: o.text, is_correct: o.is_correct, order_no: idx })));
      detailError = error;
    } else {
      const { error } = await supabase
        .from('question_matching_pairs')
        .insert(q.pairs.map((p, idx) => ({ question_id: questionId, left_text: p.left_text, right_text: p.right_text, order_no: idx })));
      detailError = error;
    }

    const { error: outcomesError } = await supabase
      .from('question_outcomes')
      .insert(outcomeIds.map((outcomeId) => ({ question_id: questionId, outcome_id: outcomeId })));

    if (detailError || outcomesError) {
      return NextResponse.json({ error: 'Detaylar veya kazanım bağlantısı kaydedilemedi' }, { status: 500 });
    }

    savedCount += 1;
  }

  return NextResponse.json({ ok: true, savedCount });
}
