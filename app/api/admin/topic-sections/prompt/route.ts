import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type TopicRow = { id: number; title: string; unit_id: number };
type UnitRow = { id: number; title: string; lesson_id: number; grade_id: number };
type OutcomeRow = { id: number; description: string; order_index: number | null; code: string | null };
type SectionRow = { id: number; heading: string; order_no: number; body_markdown?: string | null };
type SectionOutcomeLinkRow = { section_id: number; outcome_id: number };

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = request.nextUrl.searchParams.get('topicId');
  const type = request.nextUrl.searchParams.get('type');
  const sectionId = request.nextUrl.searchParams.get('sectionId');

  const QUESTION_TEMPLATES: Record<string, string> = {
    mixed_questions: '06-section-mixed-questions.md',
  };
  const isQuestionType = !!type && type in QUESTION_TEMPLATES;

  if (!topicId || (type !== 'plan' && type !== 'section' && !isQuestionType)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: topic } = await supabase.from('topics').select('id, title, unit_id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });
  const topicRow = topic as TopicRow;

  const { data: unit } = await supabase.from('units').select('id, title, lesson_id, grade_id').eq('id', topicRow.unit_id).maybeSingle();
  const unitRow = unit as UnitRow | null;

  let gradeName = '';
  let lessonName = '';
  if (unitRow) {
    const { data: lesson } = await supabase.from('lessons').select('name').eq('id', unitRow.lesson_id).maybeSingle();
    lessonName = (lesson as { name: string } | null)?.name || '';
    const { data: grade } = await supabase.from('grades').select('name').eq('id', unitRow.grade_id).maybeSingle();
    gradeName = (grade as { name: string } | null)?.name || '';
  }
  const unitTitle = unitRow?.title || '';

  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, description, order_index, code')
    .eq('topic_id', topicRow.id)
    .order('order_index', { ascending: true });

  const outcomes = (outcomesData as OutcomeRow[] | null) || [];

  if (type === 'plan') {
    const missingCodeCount = outcomes.filter((o) => !o.code?.trim()).length;
    if (missingCodeCount > 0) {
      return NextResponse.json(
        { error: `${missingCodeCount} kazanımın kodu eksik. Önce "Eksik Kodları Ata" ile kodları tamamlayın.` },
        { status: 409 }
      );
    }

    const templatePath = path.join(process.cwd(), 'app', 'prompt', '01-topic-section-plan.md');
    const template = await readFile(templatePath, 'utf8');

    const outcomesText = outcomes.length
      ? outcomes.map((o) => `${o.code}) ${o.description}`).join('\n')
      : 'Bu konu için tanımlı kazanım bulunamadı.';

    const prompt = template
      .replaceAll('{grade}', gradeName)
      .replaceAll('{lesson}', lessonName)
      .replaceAll('{unit}', unitTitle)
      .replaceAll('{topic}', topicRow.title)
      .replaceAll('{outcomes listesi, kod + metin}', outcomesText);

    return NextResponse.json({ prompt });
  }

  if (!sectionId) return NextResponse.json({ error: 'sectionId gerekli' }, { status: 400 });

  const { data: topicContent } = await supabase.from('topic_contents').select('id').eq('topic_id', topicRow.id).maybeSingle();
  if (!topicContent) return NextResponse.json({ error: 'Önce alt başlık planı oluşturulmalı' }, { status: 404 });

  const { data: allSections } = await supabase
    .from('topic_content_sections')
    .select('id, heading, order_no, body_markdown')
    .eq('topic_content_id', (topicContent as { id: number }).id)
    .order('order_no', { ascending: true });

  const sections = (allSections as SectionRow[] | null) || [];
  const currentSection = sections.find((s) => String(s.id) === String(sectionId));
  if (!currentSection) return NextResponse.json({ error: 'Alt başlık bulunamadı' }, { status: 404 });

  const { data: linksData } = await supabase
    .from('topic_content_section_outcomes')
    .select('section_id, outcome_id')
    .eq('section_id', currentSection.id);

  const linkedOutcomeIds = ((linksData as SectionOutcomeLinkRow[] | null) || []).map((l) => l.outcome_id);

  const matchedOutcomes = linkedOutcomeIds.length
    ? outcomes.filter((o) => linkedOutcomeIds.includes(o.id))
    : outcomes;

  const sectionOutcomesText = matchedOutcomes.length
    ? matchedOutcomes.map((o) => `${o.code || '?'}) ${o.description}`).join('\n')
    : 'Bu alt başlık için tanımlı kazanım bulunamadı.';

  if (isQuestionType) {
    if (!currentSection.body_markdown?.trim()) {
      return NextResponse.json({ error: 'Önce bu alt başlığın ders notu (içeriği) oluşturulmalı' }, { status: 409 });
    }

    const templatePath = path.join(process.cwd(), 'app', 'prompt', QUESTION_TEMPLATES[type as string]);
    const template = await readFile(templatePath, 'utf8');

    const prompt = template
      .replaceAll('{grade}', gradeName)
      .replaceAll('{lesson}', lessonName)
      .replaceAll('{unit}', unitTitle)
      .replaceAll('{topic}', topicRow.title)
      .replaceAll('{heading}', currentSection.heading)
      .replaceAll('{section_outcomes}', sectionOutcomesText)
      .replaceAll('{section_content}', currentSection.body_markdown);

    return NextResponse.json({ prompt });
  }

  const otherHeadings = sections
    .filter((s) => String(s.id) !== String(sectionId))
    .map((s) => s.heading)
    .join(', ') || 'Yok';

  const templatePath = path.join(process.cwd(), 'app', 'prompt', '02-section-content.md');
  const template = await readFile(templatePath, 'utf8');

  const prompt = template
    .replaceAll('{grade}', gradeName)
    .replaceAll('{lesson}', lessonName)
    .replaceAll('{unit}', unitTitle)
    .replaceAll('{topic}', topicRow.title)
    .replaceAll('{heading}', currentSection.heading)
    .replaceAll('{section_outcomes}', sectionOutcomesText)
    .replaceAll('{other_headings}', otherHeadings);

  return NextResponse.json({ prompt });
}
