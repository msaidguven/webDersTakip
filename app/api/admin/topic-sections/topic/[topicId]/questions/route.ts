import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseQuestions, TYPE_ID, INVALID_MESSAGE } from '@/app/src/lib/parseMixedQuestions';

interface Params {
  topicId: string;
}

// Alt başlığa değil, doğrudan konunun geneline ait (section_id boş) sentez/genel tekrar
// soruları kaydeder — ünite testinde bu şekilde de gösterilir (bkz. add_question_scope_and_source.sql).
export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { topicId } = await params;
  const body = await request.json().catch(() => null);
  const questions = parseQuestions(body, 20);

  if (!questions) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
  }

  const rawAiModel = (body as { ai_model?: unknown } | null)?.ai_model;
  const aiModel = typeof rawAiModel === 'string' && rawAiModel.trim() ? rawAiModel.trim() : null;
  const source: 'manual' | 'ai_generated' = aiModel ? 'ai_generated' : 'manual';

  const supabase = createServiceClient();

  const { data: topicRow, error: topicError } = await supabase
    .from('topics')
    .select('id')
    .eq('id', topicId)
    .maybeSingle();

  if (topicError || !topicRow) {
    return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });
  }

  const { data: outcomeRows, error: outcomeError } = await supabase
    .from('outcomes')
    .select('id')
    .eq('topic_id', topicId);

  if (outcomeError) {
    return NextResponse.json({ error: 'Konu kazanımları okunamadı' }, { status: 500 });
  }

  const outcomeIds = ((outcomeRows as { id: number }[] | null) || []).map((r) => r.id);
  if (!outcomeIds.length) {
    return NextResponse.json({ error: 'Bu konuya bağlı kazanım yok' }, { status: 409 });
  }

  let savedCount = 0;

  for (const q of questions) {
    const questionText = q.kind === 'matching' ? 'Aşağıdaki kavramları doğru tanımlarıyla eşleştir.' : q.question_text;
    const solutionText = q.kind === 'matching' ? null : q.solution_text;

    const { data: questionRow, error: qError } = await supabase
      .from('questions')
      .insert({
        question_type_id: TYPE_ID[q.kind],
        question_text: questionText,
        solution_text: solutionText,
        topic_id: Number(topicId),
        section_id: null,
        source,
        ai_model: aiModel,
        svg_prompt: q.kind === 'matching' ? null : q.svg_prompt,
        svg_position: q.kind === 'matching' ? 'above' : q.svg_position,
      })
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
