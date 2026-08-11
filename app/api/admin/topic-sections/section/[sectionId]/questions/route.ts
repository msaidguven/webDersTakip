import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

interface Params {
  sectionId: string;
}

type ChoiceInput = { text?: unknown; is_correct?: unknown };
type QuestionInput = { question_text?: unknown; choices?: unknown };

function parseQuestions(body: unknown): { question_text: string; choices: { text: string; is_correct: boolean }[] }[] | null {
  const obj = body as { questions?: unknown } | null;
  if (!obj || !Array.isArray(obj.questions) || !obj.questions.length || obj.questions.length > 10) return null;

  const parsed: { question_text: string; choices: { text: string; is_correct: boolean }[] }[] = [];

  for (const q of obj.questions as QuestionInput[]) {
    if (typeof q.question_text !== 'string' || !q.question_text.trim()) return null;
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 6) return null;

    const choices: { text: string; is_correct: boolean }[] = [];
    for (const c of q.choices as ChoiceInput[]) {
      if (typeof c.text !== 'string' || !c.text.trim()) return null;
      choices.push({ text: c.text.trim(), is_correct: c.is_correct === true });
    }
    if (choices.filter((c) => c.is_correct).length !== 1) return null;

    parsed.push({ question_text: q.question_text.trim(), choices });
  }

  return parsed;
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null);
  const questions = parseQuestions(body);

  if (!questions) {
    return NextResponse.json({ error: 'Geçersiz soru listesi (her soruda 2-6 şık ve tam olarak 1 doğru şık olmalı)' }, { status: 400 });
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
    const { data: questionRow, error: qError } = await supabase
      .from('questions')
      .insert({ question_type_id: 1, question_text: q.question_text })
      .select('id')
      .single();

    if (qError || !questionRow) {
      return NextResponse.json({ error: `Soru kaydedilemedi: ${q.question_text.slice(0, 40)}` }, { status: 500 });
    }

    const questionId = (questionRow as { id: number }).id;

    const { error: choicesError } = await supabase
      .from('question_choices')
      .insert(q.choices.map((c) => ({ question_id: questionId, choice_text: c.text, is_correct: c.is_correct })));

    const { error: outcomesError } = await supabase
      .from('question_outcomes')
      .insert(outcomeIds.map((outcomeId) => ({ question_id: questionId, outcome_id: outcomeId })));

    if (choicesError || outcomesError) {
      return NextResponse.json({ error: 'Şıklar veya kazanım bağlantısı kaydedilemedi' }, { status: 500 });
    }

    savedCount += 1;
  }

  return NextResponse.json({ ok: true, savedCount });
}
