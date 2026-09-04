import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { parseQuestions, TYPE_ID, INVALID_MESSAGE } from '@/app/src/lib/parseMixedQuestions';
import { revalidateUnitPagesForTopics, revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';

interface Params {
  sectionId: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { sectionId } = await params;
  const body = await request.json().catch(() => null);
  const questions = parseQuestions(body, 20);

  if (!questions) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 });
  }

  const rawAiModel = (body as { ai_model?: unknown } | null)?.ai_model;
  const aiModel = typeof rawAiModel === 'string' && rawAiModel.trim() ? rawAiModel.trim() : null;
  const source: 'manual' | 'ai_generated' = aiModel ? 'ai_generated' : 'manual';

  const supabase = createServiceClient();

  // topic_id hiyerarşinin (ünite/ders/sınıf) tek kaynağı olacağı için client'tan değil,
  // section -> topic_content -> topic zincirinden sunucu tarafında çıkarıyoruz.
  const { data: sectionRow, error: sectionError } = await supabase
    .from('topic_content_sections')
    .select('id, topic_content_id')
    .eq('id', sectionId)
    .maybeSingle();

  if (sectionError || !sectionRow) {
    return NextResponse.json({ error: 'Alt başlık bulunamadı' }, { status: 404 });
  }

  const { data: topicContentRow, error: topicContentError } = await supabase
    .from('topic_contents')
    .select('id, topic_id')
    .eq('id', (sectionRow as { topic_content_id: number }).topic_content_id)
    .maybeSingle();

  if (topicContentError || !topicContentRow) {
    return NextResponse.json({ error: 'Konu içeriği bulunamadı' }, { status: 404 });
  }

  const topicId = (topicContentRow as { topic_id: number }).topic_id;

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
    const svgPrompt = q.kind === 'matching' ? null : q.svg_prompt;

    const { data: questionRow, error: qError } = await supabase
      .from('questions')
      .insert({
        question_type_id: TYPE_ID[q.kind],
        question_text: questionText,
        solution_text: solutionText,
        topic_id: topicId,
        section_id: Number(sectionId),
        source,
        ai_model: aiModel,
        svg_prompt: svgPrompt,
        svg_position: q.kind === 'matching' ? 'above' : q.svg_position,
        // SVG istenmiş ama henüz girilmemiş sorular admin SVG'yi ekleyip kaydedene
        // kadar taslak kalır — bkz. app/api/admin/manage/questions/route.ts PATCH'teki
        // otomatik yayınlama.
        is_active: !svgPrompt,
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

  await revalidateUnitPagesForTopics(supabase, [topicId]);
  revalidateHomepage();
  return NextResponse.json({ ok: true, savedCount });
}
