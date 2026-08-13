import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { withPreviewCodes } from '@/app/src/lib/outcomeCodes';

type TopicRow = { id: number; title: string; unit_id: number };
type UnitRow = { id: number; title: string; lesson_id: number; grade_id: number };
type LessonRow = { id: number; name: string };
type GradeRow = { id: number; name: string };
type OutcomeRow = { id: number; description: string; order_index: number | null; code: string | null };
type OutcomeWeekRow = { outcome_id: number; start_week: number; end_week: number };
type TopicContentRow = {
  id: number;
  title: string;
  body_markdown: string | null;
  is_published: boolean;
  hero_image_url: string | null;
  subtitle: string | null;
  generation_meta: unknown;
};
type HighlightRow = {
  id: number;
  position: string;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};
type SectionRow = {
  id: number;
  topic_content_id: number;
  order_no: number;
  heading: string;
  body_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  status: string;
};
type SectionOutcomeLinkRow = { section_id: number; outcome_id: number };

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const topicId = request.nextUrl.searchParams.get('topicId');
  if (!topicId) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: topic } = await supabase
    .from('topics')
    .select('id, title, unit_id')
    .eq('id', topicId)
    .maybeSingle();

  if (!topic) {
    return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });
  }

  const topicRow = topic as TopicRow;

  const { data: unit } = await supabase
    .from('units')
    .select('id, title, lesson_id, grade_id')
    .eq('id', topicRow.unit_id)
    .maybeSingle();

  const unitRow = unit as UnitRow | null;

  let lessonRow: LessonRow | null = null;
  let gradeRow: GradeRow | null = null;

  if (unitRow) {
    const { data: lesson } = await supabase.from('lessons').select('id, name').eq('id', unitRow.lesson_id).maybeSingle();
    lessonRow = lesson as LessonRow | null;
    const { data: grade } = await supabase.from('grades').select('id, name').eq('id', unitRow.grade_id).maybeSingle();
    gradeRow = grade as GradeRow | null;
  }

  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, description, order_index, code')
    .eq('topic_id', topicRow.id)
    .order('order_index', { ascending: true });

  const outcomeRows = (outcomesData as OutcomeRow[] | null) || [];

  // Kazanımın hangi hafta(lar)da işlendiğini de gösterebilmek için outcome_weeks'i eşleştiriyoruz;
  // bir konunun kazanımları farklı haftalara dağılmış olabilir (müfredat böyle planlanmış olabilir).
  const outcomeIds = outcomeRows.map((o) => o.id);
  const weekByOutcomeId = new Map<number, { startWeek: number; endWeek: number }>();
  if (outcomeIds.length) {
    const { data: weeksData } = await supabase
      .from('outcome_weeks')
      .select('outcome_id, start_week, end_week')
      .in('outcome_id', outcomeIds);
    ((weeksData as OutcomeWeekRow[] | null) || []).forEach((w) => {
      weekByOutcomeId.set(w.outcome_id, { startWeek: w.start_week, endWeek: w.end_week });
    });
  }

  const outcomesWithWeeks = outcomeRows.map((o) => ({
    ...o,
    startWeek: weekByOutcomeId.get(o.id)?.startWeek ?? null,
    endWeek: weekByOutcomeId.get(o.id)?.endWeek ?? null,
  }));

  const outcomes = withPreviewCodes(outcomesWithWeeks);
  const missingCodeCount = outcomes.filter((o) => !o.code).length;

  const { data: topicContent } = await supabase
    .from('topic_contents')
    .select('id, title, body_markdown, is_published, hero_image_url, subtitle, generation_meta')
    .eq('topic_id', topicRow.id)
    .maybeSingle();

  const topicContentRow = topicContent as TopicContentRow | null;
  const heroImagePrompt = (() => {
    const meta = topicContentRow?.generation_meta;
    if (!meta || typeof meta !== 'object') return null;
    const val = (meta as Record<string, unknown>).heroImagePrompt;
    return typeof val === 'string' && val.trim() ? val : null;
  })();

  let highlights: HighlightRow[] = [];
  let sections: SectionRow[] = [];
  let sectionOutcomeMap: Record<number, number[]> = {};

  if (topicContentRow) {
    const { data: highlightsData } = await supabase
      .from('topic_content_highlights')
      .select('id, position, icon, title, description, order_no')
      .eq('topic_content_id', topicContentRow.id)
      .order('order_no', { ascending: true });
    highlights = (highlightsData as HighlightRow[] | null) || [];
  }

  if (topicContentRow) {
    const { data: sectionsData } = await supabase
      .from('topic_content_sections')
      .select('id, topic_content_id, order_no, heading, body_markdown, image_url, image_prompt, status')
      .eq('topic_content_id', topicContentRow.id)
      .order('order_no', { ascending: true });
    sections = (sectionsData as SectionRow[] | null) || [];

    if (sections.length) {
      const { data: linksData } = await supabase
        .from('topic_content_section_outcomes')
        .select('section_id, outcome_id')
        .in('section_id', sections.map((s) => s.id));

      const links = (linksData as SectionOutcomeLinkRow[] | null) || [];
      sectionOutcomeMap = links.reduce<Record<number, number[]>>((acc, link) => {
        (acc[link.section_id] ||= []).push(link.outcome_id);
        return acc;
      }, {});
    }
  }

  const outcomeById = new Map(outcomes.map((o) => [o.id, o]));

  const sectionsWithOutcomes = sections.map((s) => ({
    ...s,
    outcomes: (sectionOutcomeMap[s.id] || [])
      .map((id) => outcomeById.get(id))
      .filter((o): o is (typeof outcomes)[number] => Boolean(o))
      .map((o) => ({ id: o.id, code: o.code, description: o.description })),
  }));

  return NextResponse.json({
    topic: { id: topicRow.id, title: topicRow.title },
    unit: unitRow ? { id: unitRow.id, title: unitRow.title } : null,
    lesson: lessonRow,
    grade: gradeRow,
    outcomes,
    missingCodeCount,
    topicContent: topicContentRow,
    heroImagePrompt,
    highlights,
    sections: sectionsWithOutcomes,
  });
}
