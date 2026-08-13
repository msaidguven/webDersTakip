import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { withPreviewCodes } from '@/app/src/lib/outcomeCodes';

type UnitRow = { id: number };
type TopicRow = { id: number; title: string };
type OutcomeRow = { id: number; description: string; topic_id: number; order_index: number | null; code: string | null };
type OutcomeWeekRow = { outcome_id: number; start_week: number; end_week: number };

// Kazanımlar modali için: bir dersin (grade+lesson) TÜM haftalarına ait kazanımlarını
// tek istekte döner. Kazanımlar modali her hafta için ayrı ayrı /api/lesson-week-data
// çağırmak yerine bunu bir kere çekip haftaya göre kendi içinde filtreleyebilir —
// lesson-week-data her çağrıda ünitenin tüm konu içeriğini (bölümler, görseller, vb.)
// de kurduğu için haftalar arası tekrar tekrar çağrılması gereksiz yük oluşturuyordu.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeId = Number(searchParams.get('gradeId'));
  const lessonId = Number(searchParams.get('lessonId'));

  if (![gradeId, lessonId].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Eksik veya hatalı parametre' }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: unitsData } = await supabase
    .from('units')
    .select('id')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .eq('is_active', true);

  const unitIds = ((unitsData as UnitRow[] | null) || []).map((u) => u.id);
  if (!unitIds.length) {
    return NextResponse.json({ outcomes: [] });
  }

  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title')
    .in('unit_id', unitIds)
    .eq('is_active', true);

  const topics = (topicsData as TopicRow[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  const topicTitleById = new Map(topics.map((t) => [t.id, t.title]));
  if (!topicIds.length) {
    return NextResponse.json({ outcomes: [] });
  }

  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, description, topic_id, order_index, code')
    .in('topic_id', topicIds)
    .order('order_index', { ascending: true });

  const outcomeRows = (outcomesData as OutcomeRow[] | null) || [];
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

  // Harf kodları (a, b, c...) her konu kendi içinde 1'den başladığı için sıralama ve
  // kodlama konu bazında yapılmalı — tüm dersi tek listede sıralarsak harfler anlamsızlaşır.
  const rowsByTopic = new Map<number, (OutcomeRow & { startWeek: number | null })[]>();
  for (const o of outcomeRows) {
    const list = rowsByTopic.get(o.topic_id) || [];
    list.push({ ...o, startWeek: weekByOutcomeId.get(o.id)?.startWeek ?? null });
    rowsByTopic.set(o.topic_id, list);
  }

  const outcomes = Array.from(rowsByTopic.entries()).flatMap(([topicId, rows]) =>
    withPreviewCodes(rows).map((o) => ({
      id: o.id,
      description: o.description,
      topicId,
      topicTitle: topicTitleById.get(topicId) || '',
      startWeek: o.startWeek,
      endWeek: weekByOutcomeId.get(o.id)?.endWeek ?? null,
      code: o.code,
      previewCode: o.previewCode,
    }))
  );

  return NextResponse.json({ outcomes });
}
