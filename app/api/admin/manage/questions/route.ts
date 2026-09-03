import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteQuestionsCascade } from '@/app/src/lib/adminCascade';
import { revalidateUnitPagesForQuestionIds, revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';

const BULK_EDITABLE_FIELDS = ['difficulty', 'score'] as const;
const MAX_SVG_LENGTH = 20_000;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const id = request.nextUrl.searchParams.get('id');

  // Tekli detay: düzenleme modalı için şık/seçenek/eşleştirme/klasik alt tablolarını da döner.
  if (id) {
    const { data: question, error } = await supabase
      .from('questions')
      .select('id, question_type_id, question_text, difficulty, score, solution_text, svg_content, svg_prompt, svg_position, question_types(code)')
      .eq('id', id)
      .maybeSingle();

    if (error || !question) return NextResponse.json({ error: 'Soru bulunamadı' }, { status: 404 });

    const [{ data: choices }, { data: blankOptions }, { data: matchingPairs }, { data: classical }] = await Promise.all([
      supabase.from('question_choices').select('id, choice_text, is_correct').eq('question_id', id),
      supabase.from('question_blank_options').select('id, option_text, is_correct, order_no').eq('question_id', id).order('order_no'),
      supabase.from('question_matching_pairs').select('id, left_text, right_text, order_no').eq('question_id', id).order('order_no'),
      supabase.from('question_classical').select('model_answer, answer_words').eq('question_id', id).maybeSingle(),
    ]);

    return NextResponse.json({
      question,
      choices: choices || [],
      blankOptions: blankOptions || [],
      matchingPairs: matchingPairs || [],
      classical: classical || null,
    });
  }

  const topicId = request.nextUrl.searchParams.get('topicId');
  const unitId = request.nextUrl.searchParams.get('unitId');
  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const search = request.nextUrl.searchParams.get('search');
  const difficulty = request.nextUrl.searchParams.get('difficulty');
  const typeId = request.nextUrl.searchParams.get('typeId');

  let unitIds: number[] | null = null;
  if (!topicId && !unitId && (gradeId || lessonId)) {
    let unitQuery = supabase.from('units').select('id');
    if (gradeId) unitQuery = unitQuery.eq('grade_id', gradeId);
    if (lessonId) unitQuery = unitQuery.eq('lesson_id', lessonId);
    const { data: unitRows } = await unitQuery;
    unitIds = ((unitRows as { id: number }[] | null) || []).map((r) => r.id);
    if (!unitIds.length) return NextResponse.json({ items: [] });
  }

  let topicIds: number[] | null = null;
  if (!topicId && (unitId || unitIds)) {
    let topicQuery = supabase.from('topics').select('id');
    if (unitId) topicQuery = topicQuery.eq('unit_id', unitId);
    else if (unitIds) topicQuery = topicQuery.in('unit_id', unitIds);
    const { data: topicRows } = await topicQuery;
    topicIds = ((topicRows as { id: number }[] | null) || []).map((r) => r.id);
    if (!topicIds.length) return NextResponse.json({ items: [] });
  }

  let query = supabase
    .from('questions')
    .select('id, question_type_id, question_text, difficulty, score, created_at, question_types(code)')
    .order('created_at', { ascending: false })
    .limit(200);

  // Bağlantı doğrudan questions.topic_id üzerinden (bkz. add_question_scope_and_source.sql).
  if (topicId) query = query.eq('topic_id', topicId);
  else if (topicIds) query = query.in('topic_id', topicIds);
  if (search) query = query.ilike('question_text', `%${search}%`);
  if (difficulty) query = query.eq('difficulty', difficulty);
  if (typeId) query = query.eq('question_type_id', typeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
}

type ChoiceInput = { choice_text: string; is_correct: boolean };
type BlankOptionInput = { option_text: string; is_correct: boolean; order_no: number };
type MatchingPairInput = { left_text: string; right_text: string; order_no: number };
type ClassicalInput = { model_answer: string | null; answer_words: string[] };

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as {
    id?: unknown;
    ids?: unknown;
    patch?: unknown;
    choices?: unknown;
    blankOptions?: unknown;
    matchingPairs?: unknown;
    classical?: unknown;
  } | null;

  const supabase = createServiceClient();

  // Tekli düzenleme (alt tablolarla birlikte)
  if (typeof body?.id === 'number') {
    const questionId = body.id;
    const rawPatch = body.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : {};

    const patch: Record<string, unknown> = {};
    for (const key of ['question_text', 'difficulty', 'score', 'solution_text', 'svg_content', 'svg_prompt', 'svg_position']) {
      if (key in rawPatch) patch[key] = rawPatch[key];
    }
    if ('svg_content' in patch && patch.svg_content != null) {
      const svg = String(patch.svg_content).trim();
      if (!svg) {
        patch.svg_content = null;
      } else if (!svg.startsWith('<svg') || !svg.endsWith('</svg>') || svg.length > MAX_SVG_LENGTH) {
        return NextResponse.json({ error: 'Geçersiz SVG kodu' }, { status: 400 });
      } else {
        patch.svg_content = svg;
      }
    }
    if ('svg_prompt' in patch) {
      const prompt = patch.svg_prompt != null ? String(patch.svg_prompt).trim() : '';
      patch.svg_prompt = prompt || null;
    }
    if ('svg_position' in patch) {
      patch.svg_position = patch.svg_position === 'below' ? 'below' : 'above';
    }
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('questions').update(patch).eq('id', questionId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (Array.isArray(body.choices)) {
      const choices = body.choices as ChoiceInput[];
      await supabase.from('question_choices').delete().eq('question_id', questionId);
      if (choices.length) {
        const { error } = await supabase
          .from('question_choices')
          .insert(choices.map((c) => ({ question_id: questionId, choice_text: c.choice_text, is_correct: c.is_correct })));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (Array.isArray(body.blankOptions)) {
      const options = body.blankOptions as BlankOptionInput[];
      await supabase.from('question_blank_options').delete().eq('question_id', questionId);
      if (options.length) {
        const { error } = await supabase
          .from('question_blank_options')
          .insert(options.map((o, idx) => ({ question_id: questionId, option_text: o.option_text, is_correct: o.is_correct, order_no: idx })));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (Array.isArray(body.matchingPairs)) {
      const pairs = body.matchingPairs as MatchingPairInput[];
      await supabase.from('question_matching_pairs').delete().eq('question_id', questionId);
      if (pairs.length) {
        const { error } = await supabase
          .from('question_matching_pairs')
          .insert(pairs.map((p, idx) => ({ question_id: questionId, left_text: p.left_text, right_text: p.right_text, order_no: idx })));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (body.classical && typeof body.classical === 'object') {
      const classical = body.classical as ClassicalInput;
      const { error } = await supabase
        .from('question_classical')
        .upsert({ question_id: questionId, model_answer: classical.model_answer, answer_words: classical.answer_words || [] }, { onConflict: 'question_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await revalidateUnitPagesForQuestionIds(supabase, [questionId]);
    return NextResponse.json({ ok: true });
  }

  // Toplu düzenleme (sadece zorluk/puan gibi ortak alanlar)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  const rawPatch = body?.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : null;

  if (!ids.length || !rawPatch) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of BULK_EDITABLE_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const { error } = await supabase.from('questions').update(patch).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await revalidateUnitPagesForQuestionIds(supabase, ids);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  // Silinmeden ÖNCE topic'leri çözüp cache'i düşürüyoruz — satırlar gittikten sonra
  // question->topic zinciri kurulamaz.
  await revalidateUnitPagesForQuestionIds(supabase, ids);
  revalidateHomepage();
  const result = await deleteQuestionsCascade(supabase, ids);
  return NextResponse.json(result);
}
