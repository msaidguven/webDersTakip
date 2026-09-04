import { readFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { sortOutcomesByWeek } from '@/app/src/lib/outcomeCodes';
import { buildSvgLessonGuidance, buildQuestionCountInstruction } from '@/app/src/lib/promptHelpers';

type TopicRow = { id: number; title: string; unit_id: number };
type UnitRow = { id: number; title: string; lesson_id: number; grade_id: number };
type OutcomeRow = { id: number; description: string; order_index: number | null; code: string | null };
type OutcomeWeekRow = { outcome_id: number; start_week: number };
type SectionRow = { id: number; heading: string; order_no: number; body_markdown?: string | null };
type SectionOutcomeLinkRow = { section_id: number; outcome_id: number };

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = request.nextUrl.searchParams.get('topicId');
  const type = request.nextUrl.searchParams.get('type');
  const sectionId = request.nextUrl.searchParams.get('sectionId');
  const countParam = request.nextUrl.searchParams.get('count');

  const QUESTION_TEMPLATES: Record<string, string> = {
    mixed_questions: '06-section-mixed-questions.md',
    classical_questions: '13-section-classical-questions.md',
  };
  const isQuestionType = !!type && type in QUESTION_TEMPLATES;

  // NotebookLM'e özel soru promptu: genel promptun aksine bizim ürettiğimiz notu değil,
  // yüklenen kaynak kitabı temel alır — bu yüzden section_content gerekmez.
  const NOTEBOOK_QUESTION_TEMPLATES: Record<string, string> = {
    questions_notebooklm: '10-section-questions-notebooklm.md',
  };
  const isNotebookQuestionType = !!type && type in NOTEBOOK_QUESTION_TEMPLATES;

  // Bunlar bir alt başlığa değil, doğrudan ana konuya bağlı promptlar (sectionId gerekmez).
  const TOPIC_LEVEL_TEMPLATES: Record<string, string> = {
    cover_image: '05-topic-cover-image.md',
    highlights: '07-topic-highlights.md',
    topic_questions: '11-topic-general-questions.md',
    topic_questions_mixed: '12-topic-mixed-questions.md',
    topic_questions_classical: '14-topic-classical-questions.md',
  };
  const isTopicLevelType = !!type && type in TOPIC_LEVEL_TEMPLATES;

  const VALID_TYPES = new Set([
    'plan', 'full', 'section', 'section_notebooklm', 'image', 'diagram',
  ]);

  if (!topicId || (!VALID_TYPES.has(type || '') && !isQuestionType && !isNotebookQuestionType && !isTopicLevelType)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const svgQuestionInstructions = await readFile(path.join(process.cwd(), 'app', 'prompt', '_svg-question-fragment.md'), 'utf8');

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

  const outcomeRows = (outcomesData as OutcomeRow[] | null) || [];

  // order_index konu içinde benzersiz değil (her hafta kendi 1'den başlayan sırasına sahip
  // olabiliyor); AI'a giden kazanım listesi haftalar arası karışmasın diye önce haftayı ekleyip
  // ona göre sıralıyoruz.
  const outcomeIds = outcomeRows.map((o) => o.id);
  const weekByOutcomeId = new Map<number, number>();
  if (outcomeIds.length) {
    const { data: weeksData } = await supabase
      .from('outcome_weeks')
      .select('outcome_id, start_week')
      .in('outcome_id', outcomeIds);
    ((weeksData as OutcomeWeekRow[] | null) || []).forEach((w) => {
      weekByOutcomeId.set(w.outcome_id, w.start_week);
    });
  }

  const outcomes = sortOutcomesByWeek(
    outcomeRows.map((o) => ({ ...o, startWeek: weekByOutcomeId.get(o.id) ?? null }))
  );

  if (type === 'plan' || type === 'full') {
    const missingCodeCount = outcomes.filter((o) => !o.code?.trim()).length;
    if (missingCodeCount > 0) {
      return NextResponse.json(
        { error: `${missingCodeCount} kazanımın kodu eksik. Önce "Eksik Kodları Ata" ile kodları tamamlayın.` },
        { status: 409 }
      );
    }

    const templateFile = type === 'full' ? '03-notebooklm-full-topic.md' : '01-topic-section-plan.md';
    const templatePath = path.join(process.cwd(), 'app', 'prompt', templateFile);
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

  if (isTopicLevelType) {
    const outcomesText = outcomes.length
      ? outcomes.map((o) => `${o.code || '?'}) ${o.description}`).join('\n')
      : 'Bu konu için tanımlı kazanım bulunamadı.';

    let topicContentText = '';
    let sectionHeadingsText = '';
    let sectionRows: { heading: string; body_markdown: string | null }[] = [];
    if (type === 'highlights' || type === 'topic_questions' || type === 'topic_questions_mixed' || type === 'topic_questions_classical') {
      const { data: topicContent } = await supabase.from('topic_contents').select('id').eq('topic_id', topicRow.id).maybeSingle();
      if (topicContent) {
        const { data: sectionsData } = await supabase
          .from('topic_content_sections')
          .select('heading, body_markdown, order_no')
          .eq('topic_content_id', (topicContent as { id: number }).id)
          .order('order_no', { ascending: true });
        sectionRows = (sectionsData as { heading: string; body_markdown: string | null }[] | null) || [];
      }
    }

    if (type === 'highlights') {
      topicContentText = sectionRows
        .filter((s) => s.body_markdown?.trim())
        .map((s) => `### ${s.heading}\n${s.body_markdown}`)
        .join('\n\n');
    }

    // NotebookLM zaten kaynak kitabı bildiği için topic_questions promptuna içerik
    // gömmüyoruz (uzunluk/karakter sınırı yüzünden) — sadece hangi alt başlıkları
    // kapsaması gerektiğini kısa bir liste olarak veriyoruz. Diğer AI'lar (topic_questions_mixed)
    // kitaba erişemediği için onlara alt başlıkların tam ders notunu gömüyoruz.
    if (type === 'topic_questions' || type === 'topic_questions_mixed') {
      sectionHeadingsText = sectionRows.map((s) => s.heading).join(', ');
      if (!sectionHeadingsText.trim()) {
        return NextResponse.json({ error: 'Önce alt başlık planı oluşturulmalı' }, { status: 409 });
      }
    }

    if (type === 'topic_questions_mixed' || type === 'topic_questions_classical') {
      topicContentText = sectionRows
        .filter((s) => s.body_markdown?.trim())
        .map((s) => `### ${s.heading}\n${s.body_markdown}`)
        .join('\n\n');
      if (!topicContentText.trim()) {
        return NextResponse.json({ error: 'Önce alt başlıkların ders notu (içeriği) oluşturulmalı' }, { status: 409 });
      }
    }

    const templatePath = path.join(process.cwd(), 'app', 'prompt', TOPIC_LEVEL_TEMPLATES[type as string]);
    const template = await readFile(templatePath, 'utf8');

    const prompt = template
      .replaceAll('{grade}', gradeName)
      .replaceAll('{lesson}', lessonName)
      .replaceAll('{unit}', unitTitle)
      .replaceAll('{topic}', topicRow.title)
      .replaceAll('{outcomes listesi, kod + metin}', outcomesText)
      .replaceAll('{topic_content}', topicContentText || 'Bu konu için henüz ders notu (içerik) oluşturulmamış.')
      .replaceAll('{section_headings}', sectionHeadingsText)
      .replaceAll('{question_count_instruction}', buildQuestionCountInstruction(countParam, '6-10'))
      .replaceAll('{svg_question_instructions}', svgQuestionInstructions.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(lessonName)));

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

  if (isNotebookQuestionType) {
    const templatePath = path.join(process.cwd(), 'app', 'prompt', NOTEBOOK_QUESTION_TEMPLATES[type as string]);
    const template = await readFile(templatePath, 'utf8');

    const prompt = template
      .replaceAll('{grade}', gradeName)
      .replaceAll('{lesson}', lessonName)
      .replaceAll('{unit}', unitTitle)
      .replaceAll('{topic}', topicRow.title)
      .replaceAll('{heading}', currentSection.heading)
      .replaceAll('{section_outcomes}', sectionOutcomesText)
      .replaceAll('{svg_question_instructions}', svgQuestionInstructions.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(lessonName)));

    return NextResponse.json({ prompt });
  }

  if (isQuestionType || type === 'image' || type === 'diagram') {
    if (!currentSection.body_markdown?.trim()) {
      return NextResponse.json({ error: 'Önce bu alt başlığın ders notu (içeriği) oluşturulmalı' }, { status: 409 });
    }

    const templateFile =
      type === 'image' ? '04-section-image.md' : type === 'diagram' ? '08-section-diagram.md' : QUESTION_TEMPLATES[type as string];
    const templatePath = path.join(process.cwd(), 'app', 'prompt', templateFile);
    const template = await readFile(templatePath, 'utf8');

    const prompt = template
      .replaceAll('{grade}', gradeName)
      .replaceAll('{lesson}', lessonName)
      .replaceAll('{unit}', unitTitle)
      .replaceAll('{topic}', topicRow.title)
      .replaceAll('{heading}', currentSection.heading)
      .replaceAll('{section_outcomes}', sectionOutcomesText)
      .replaceAll('{section_content}', currentSection.body_markdown)
      .replaceAll('{question_count_instruction}', buildQuestionCountInstruction(countParam, '3-6'))
      .replaceAll('{svg_question_instructions}', svgQuestionInstructions.replaceAll('{svg_lesson_guidance}', buildSvgLessonGuidance(lessonName)));

    return NextResponse.json({ prompt });
  }

  const otherHeadings = sections
    .filter((s) => String(s.id) !== String(sectionId))
    .map((s) => s.heading)
    .join(', ') || 'Yok';

  const templatePath = path.join(
    process.cwd(),
    'app',
    'prompt',
    type === 'section_notebooklm' ? '09-section-content-notebooklm.md' : '02-section-content.md'
  );
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
