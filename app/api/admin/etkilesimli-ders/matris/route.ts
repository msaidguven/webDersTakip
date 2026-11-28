import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { HAND_WRITTEN_TOPIC_IDS, getLessonDefinition } from '@/app/src/lib/interactiveLesson/registry';
import { isLessonV2 } from '@/app/src/lib/interactiveLesson/typesV2';
import { isLessonV3 } from '@/app/src/lib/interactiveLesson/typesV3';

export const dynamic = 'force-dynamic';

export type MatrixLessonVersion = '3.2' | '3.1' | '3.0' | '2' | '1' | null;

export type MatrixTopicCell = {
  topicId: number;
  title: string;
  unitTitle: string;
  href: string | null;
  startWeek: number;
  endWeek: number;
  version: MatrixLessonVersion;
  status: string | null;
  voiceDone: boolean;
  hasPublishedContent: boolean;
  handWritten: boolean;
};

export type MatrixLessonCol = {
  lessonId: number;
  name: string;
  slug: string | null;
};

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number | null;
  lesson_id: number;
  lessons: { id: number; name: string; slug: string | null } | null;
  grades: { id: number; name: string; slug: string | null } | null;
};

type TopicRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number | null;
  unit_id: number;
};

function detectVersion(topicId: number, rawLesson: Record<string, unknown> | null): MatrixLessonVersion {
  if (rawLesson) {
    if (isLessonV3(rawLesson)) {
      if (rawLesson.schemaVersion === '3.2') return '3.2';
      if (rawLesson.schemaVersion === '3.1') return '3.1';
      return '3.0';
    }
    if (isLessonV2(rawLesson)) return '2';
    return '1';
  }
  const hw = getLessonDefinition(topicId);
  if (!hw) return null;
  if (isLessonV3(hw)) return hw.schemaVersion === '3.2' ? '3.2' : hw.schemaVersion === '3.1' ? '3.1' : '3.0';
  if (isLessonV2(hw)) return '2';
  return '1';
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();

  const { data: gradeRows, error: gradeErr } = await supabase
    .from('grades')
    .select('id, name, slug, order_no')
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  if (gradeErr) return NextResponse.json({ error: gradeErr.message }, { status: 500 });

  const grades = (gradeRows ?? []) as { id: number; name: string; slug: string | null; order_no: number | null }[];
  if (!grades.length) {
    return NextResponse.json({ grades: [], selectedGradeId: null, lessons: [], weeks: [], cells: {}, summary: {} });
  }

  const requestedId = Number(req.nextUrl.searchParams.get('gradeId'));
  const selectedGrade =
    grades.find((g) => g.id === requestedId) ??
    grades.find((g) => /6/.test(g.name)) ??
    grades[0];

  const { data: unitRows, error: unitErr } = await supabase
    .from('units')
    .select('id, title, slug, order_no, lesson_id, lessons(id, name, slug), grades(id, name, slug)')
    .eq('grade_id', selectedGrade.id)
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  if (unitErr) return NextResponse.json({ error: unitErr.message }, { status: 500 });

  const units = (unitRows ?? []) as unknown as UnitRow[];
  const unitMap = new Map<number, UnitRow>(units.map((u) => [u.id, u]));
  const lessonMap = new Map<number, MatrixLessonCol>();
  for (const u of units) {
    if (u.lessons && !lessonMap.has(u.lessons.id)) {
      lessonMap.set(u.lessons.id, {
        lessonId: u.lessons.id,
        name: u.lessons.name,
        slug: u.lessons.slug,
      });
    }
  }
  const lessons = [...lessonMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const unitIds = units.map((u) => u.id);

  if (!unitIds.length) {
    return NextResponse.json({ grades, selectedGradeId: selectedGrade.id, lessons, weeks: [], cells: {}, summary: {} });
  }

  const { data: topicRows, error: topicErr } = await supabase
    .from('topics')
    .select('id, title, slug, order_no, unit_id')
    .in('unit_id', unitIds)
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  if (topicErr) return NextResponse.json({ error: topicErr.message }, { status: 500 });

  const topics = (topicRows ?? []) as TopicRow[];
  const topicIds = topics.map((t) => t.id);
  if (!topicIds.length) {
    return NextResponse.json({ grades, selectedGradeId: selectedGrade.id, lessons, weeks: [], cells: {}, summary: {} });
  }

  // Paralel olarak: kazanım haftaları, yayınlı içerik durumu, etkileşimli ders durumu
  const [outcomesRes, contentsRes, interactiveRes] = await Promise.all([
    supabase
      .from('outcomes')
      .select('topic_id, outcome_weeks(start_week, end_week)')
      .in('topic_id', topicIds)
      .eq('is_current', true),
    supabase
      .from('topic_contents')
      .select('topic_id')
      .in('topic_id', topicIds)
      .eq('is_published', true),
    supabase
      .from('interactive_lessons')
      .select('topic_id, status, voice_done, lesson')
      .in('topic_id', topicIds),
  ]);

  if (outcomesRes.error) return NextResponse.json({ error: outcomesRes.error.message }, { status: 500 });
  if (contentsRes.error) return NextResponse.json({ error: contentsRes.error.message }, { status: 500 });
  if (interactiveRes.error) return NextResponse.json({ error: interactiveRes.error.message }, { status: 500 });

  const weekSpanMap = new Map<number, { min: number; max: number }>();
  for (const row of (outcomesRes.data ?? []) as {
    topic_id: number;
    outcome_weeks: { start_week: number; end_week: number | null }[] | null;
  }[]) {
    for (const w of row.outcome_weeks ?? []) {
      const start = Number(w.start_week);
      const end = Number(w.end_week ?? w.start_week);
      if (!Number.isFinite(start) || start <= 0) continue;
      const cur = weekSpanMap.get(row.topic_id);
      if (!cur) weekSpanMap.set(row.topic_id, { min: start, max: Math.max(start, end) });
      else {
        cur.min = Math.min(cur.min, start);
        cur.max = Math.max(cur.max, end);
      }
    }
  }

  const publishedSet = new Set<number>(((contentsRes.data ?? []) as { topic_id: number }[]).map((c) => c.topic_id));
  const ilMap = new Map<
    number,
    { status: string; voice_done: boolean; lesson: Record<string, unknown> | null }
  >();
  for (const row of (interactiveRes.data ?? []) as {
    topic_id: number;
    status: string;
    voice_done: boolean;
    lesson: Record<string, unknown> | null;
  }[]) {
    ilMap.set(row.topic_id, row);
  }

  const hwSet = new Set<number>(HAND_WRITTEN_TOPIC_IDS);
  // cells["<week>:<lessonId>"] = MatrixTopicCell[]
  const cells: Record<string, MatrixTopicCell[]> = {};
  const weekSet = new Set<number>();

  const summary = {
    totalTopics: 0,
    v32: 0,
    v31: 0,
    v30: 0,
    v2: 0,
    v1: 0,
    inProgress: 0,
    none: 0,
  };

  for (const t of topics) {
    const span = weekSpanMap.get(t.id);
    if (!span) continue;
    const unit = unitMap.get(t.unit_id);
    if (!unit?.lessons) continue;

    const il = ilMap.get(t.id);
    const handWritten = hwSet.has(t.id);
    const version = detectVersion(t.id, il?.lesson ?? null);
    const status = il?.status ?? (handWritten ? 'ready' : null);
    const voiceDone = il?.voice_done ?? handWritten;

    summary.totalTopics++;
    if (status && status !== 'ready') summary.inProgress++;
    else if (status === 'ready' && !voiceDone) summary.inProgress++;
    else if (version === '3.2') summary.v32++;
    else if (version === '3.1') summary.v31++;
    else if (version === '3.0') summary.v30++;
    else if (version === '2') summary.v2++;
    else if (version === '1') summary.v1++;
    else summary.none++;

    const gSlug = unit.grades?.slug;
    const lSlug = unit.lessons.slug;
    const uSlug = unit.slug;
    const href = gSlug && lSlug && uSlug && t.slug ? `/${gSlug}/${lSlug}/${uSlug}/${t.slug}` : null;

    const cellItem: MatrixTopicCell = {
      topicId: t.id,
      title: t.title,
      unitTitle: unit.title,
      href,
      startWeek: span.min,
      endWeek: span.max,
      version,
      status,
      voiceDone,
      hasPublishedContent: publishedSet.has(t.id),
      handWritten,
    };

    for (let w = span.min; w <= span.max; w++) {
      weekSet.add(w);
      const key = `${w}:${unit.lessons.id}`;
      if (!cells[key]) cells[key] = [];
      cells[key].push(cellItem);
    }
  }

  const weeks = [...weekSet].sort((a, b) => a - b);

  return NextResponse.json({
    grades: grades.map((g) => ({ id: g.id, name: g.name })),
    selectedGradeId: selectedGrade.id,
    lessons,
    weeks,
    cells,
    summary,
  });
}
