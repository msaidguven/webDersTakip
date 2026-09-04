import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { sortOutcomesByWeek } from '@/app/src/lib/outcomeCodes';
import { buildSvgLessonGuidance, buildQuestionCountInstruction } from '@/app/src/lib/promptHelpers';
import { generateQuestionsJson } from '@/app/src/lib/geminiQuestionGen';
import { parseQuestions, INVALID_MESSAGE } from '@/app/src/lib/parseMixedQuestions';

// Admin panelindeki manuel kopyala-yapıştır akışıyla AYNI klasik soru promptunu
// (13-section-classical-questions.md / 14-topic-classical-questions.md, bkz.
// app/api/admin/topic-sections/prompt/route.ts) kullanır — tek fark, promptu kopyalayıp
// dışarıda bir AI'a sormak yerine burada doğrudan Gemini'yi çağırıp cevabı bekler.
// Üretilen sorular KAYDEDİLMEZ — admin panelinde önizleme/düzenleme ekranında
// gösterilip, admin onayladıktan sonra aynı section/topic questions POST rotasına
// (manuel akışla birebir aynı body şekliyle) gönderilir.
const MAX_COUNT = 10;

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { topicId?: unknown; sectionId?: unknown; count?: unknown } | null;
  const topicId = typeof body?.topicId === 'number' ? body.topicId : Number(body?.topicId);
  const sectionId = body?.sectionId != null ? (typeof body.sectionId === 'number' ? body.sectionId : Number(body.sectionId)) : null;
  const rawCount = typeof body?.count === 'number' ? body.count : Number(body?.count);
  const count = Number.isInteger(rawCount) && rawCount > 0 ? Math.min(rawCount, MAX_COUNT) : 5;

  if (!Number.isInteger(topicId)) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: topic } = await supabase.from('topics').select('id, title, unit_id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });
  const topicRow = topic as { id: number; title: string; unit_id: number };

  const { data: unit } = await supabase.from('units').select('id, title, lesson_id, grade_id').eq('id', topicRow.unit_id).maybeSingle();
  const unitRow = unit as { id: number; title: string; lesson_id: number; grade_id: number } | null;

  let gradeName = '';
  let lessonName = '';
  if (unitRow) {
    const { data: lesson } = await supabase.from('lessons').select('name').eq('id', unitRow.lesson_id).maybeSingle();
    lessonName = (lesson as { name: string } | null)?.name || '';
    const { data: grade } = await supabase.from('grades').select('name').eq('id', unitRow.grade_id).maybeSingle();
    gradeName = (grade as { name: string } | null)?.name || '';
  }
  const unitTitle = unitRow?.title || '';

  const svgQuestionInstructions = await readFile(path.join(process.cwd(), 'app', 'prompt', '_svg-question-fragment.md'), 'utf8');
  const svgBlock = svgQuestionInstructions.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(lessonName));

  let prompt: string;

  if (sectionId != null) {
    if (!Number.isInteger(sectionId)) return NextResponse.json({ error: 'Geçersiz sectionId' }, { status: 400 });

    const { data: sectionRow } = await supabase
      .from('topic_content_sections')
      .select('id, heading, body_markdown')
      .eq('id', sectionId)
      .maybeSingle();
    const section = sectionRow as { id: number; heading: string; body_markdown: string | null } | null;
    if (!section) return NextResponse.json({ error: 'Alt başlık bulunamadı' }, { status: 404 });
    if (!section.body_markdown?.trim()) {
      return NextResponse.json({ error: 'Önce bu alt başlığın ders notu (içeriği) oluşturulmalı' }, { status: 409 });
    }

    const { data: outcomesData } = await supabase
      .from('outcomes')
      .select('id, description, order_index, code')
      .eq('topic_id', topicId)
      .order('order_index', { ascending: true });
    const outcomeRows = (outcomesData as { id: number; description: string; order_index: number | null; code: string | null }[] | null) || [];

    const { data: linksData } = await supabase
      .from('topic_content_section_outcomes')
      .select('outcome_id')
      .eq('section_id', sectionId);
    const linkedOutcomeIds = ((linksData as { outcome_id: number }[] | null) || []).map((l) => l.outcome_id);

    const outcomeIds = outcomeRows.map((o) => o.id);
    const weekByOutcomeId = new Map<number, number>();
    if (outcomeIds.length) {
      const { data: weeksData } = await supabase.from('outcome_weeks').select('outcome_id, start_week').in('outcome_id', outcomeIds);
      ((weeksData as { outcome_id: number; start_week: number }[] | null) || []).forEach((w) => weekByOutcomeId.set(w.outcome_id, w.start_week));
    }
    const outcomes = sortOutcomesByWeek(outcomeRows.map((o) => ({ ...o, startWeek: weekByOutcomeId.get(o.id) ?? null })));
    const matchedOutcomes = linkedOutcomeIds.length ? outcomes.filter((o) => linkedOutcomeIds.includes(o.id)) : outcomes;
    const sectionOutcomesText = matchedOutcomes.length
      ? matchedOutcomes.map((o) => `${o.code || '?'}) ${o.description}`).join('\n')
      : 'Bu alt başlık için tanımlı kazanım bulunamadı.';

    const template = await readFile(path.join(process.cwd(), 'app', 'prompt', '13-section-classical-questions.md'), 'utf8');
    prompt = template
      .replaceAll('{grade}', gradeName)
      .replaceAll('{lesson}', lessonName)
      .replaceAll('{unit}', unitTitle)
      .replaceAll('{topic}', topicRow.title)
      .replaceAll('{heading}', section.heading)
      .replaceAll('{section_outcomes}', sectionOutcomesText)
      .replaceAll('{section_content}', section.body_markdown)
      .replaceAll('{question_count_instruction}', buildQuestionCountInstruction(count, '3-6'))
      .replaceAll('{svg_question_instructions}', svgBlock);
  } else {
    const { data: topicContent } = await supabase.from('topic_contents').select('id').eq('topic_id', topicId).maybeSingle();
    if (!topicContent) return NextResponse.json({ error: 'Önce alt başlık planı oluşturulmalı' }, { status: 404 });

    const { data: sectionsData } = await supabase
      .from('topic_content_sections')
      .select('heading, body_markdown, order_no')
      .eq('topic_content_id', (topicContent as { id: number }).id)
      .order('order_no', { ascending: true });
    const sectionRows = (sectionsData as { heading: string; body_markdown: string | null }[] | null) || [];
    const topicContentText = sectionRows
      .filter((s) => s.body_markdown?.trim())
      .map((s) => `### ${s.heading}\n${s.body_markdown}`)
      .join('\n\n');
    if (!topicContentText.trim()) {
      return NextResponse.json({ error: 'Önce alt başlıkların ders notu (içeriği) oluşturulmalı' }, { status: 409 });
    }

    const { data: outcomesData } = await supabase
      .from('outcomes')
      .select('id, description, order_index, code')
      .eq('topic_id', topicId)
      .order('order_index', { ascending: true });
    const outcomeRows = (outcomesData as { id: number; description: string; order_index: number | null; code: string | null }[] | null) || [];
    const outcomeIds = outcomeRows.map((o) => o.id);
    const weekByOutcomeId = new Map<number, number>();
    if (outcomeIds.length) {
      const { data: weeksData } = await supabase.from('outcome_weeks').select('outcome_id, start_week').in('outcome_id', outcomeIds);
      ((weeksData as { outcome_id: number; start_week: number }[] | null) || []).forEach((w) => weekByOutcomeId.set(w.outcome_id, w.start_week));
    }
    const outcomes = sortOutcomesByWeek(outcomeRows.map((o) => ({ ...o, startWeek: weekByOutcomeId.get(o.id) ?? null })));
    const outcomesText = outcomes.length ? outcomes.map((o) => `${o.code || '?'}) ${o.description}`).join('\n') : 'Bu konu için tanımlı kazanım bulunamadı.';

    const template = await readFile(path.join(process.cwd(), 'app', 'prompt', '14-topic-classical-questions.md'), 'utf8');
    prompt = template
      .replaceAll('{grade}', gradeName)
      .replaceAll('{lesson}', lessonName)
      .replaceAll('{unit}', unitTitle)
      .replaceAll('{topic}', topicRow.title)
      .replaceAll('{outcomes listesi, kod + metin}', outcomesText)
      .replaceAll('{topic_content}', topicContentText)
      .replaceAll('{question_count_instruction}', buildQuestionCountInstruction(count, '6-10'))
      .replaceAll('{svg_question_instructions}', svgBlock);
  }

  let raw: unknown;
  try {
    raw = await generateQuestionsJson(prompt);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AI çağrısı başarısız oldu' }, { status: 502 });
  }

  const questions = parseQuestions(raw, MAX_COUNT);
  if (!questions) return NextResponse.json({ error: INVALID_MESSAGE }, { status: 502 });

  const aiModel = typeof (raw as { ai_model?: unknown } | null)?.ai_model === 'string' ? (raw as { ai_model: string }).ai_model.trim() || null : null;

  return NextResponse.json({ questions, aiModel });
}
