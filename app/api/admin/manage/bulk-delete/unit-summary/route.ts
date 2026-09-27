import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { fetchAllRows } from '@/app/src/lib/fetchAllRows';
import { getQuestionCountsByTopicId } from '@/app/src/lib/questionCounts';

type UnitSummary = { id: number; title: string; topicCount: number; outcomeCount: number; questionCount: number; contentCount: number };

// Bir ders+sınıftaki tüm ünitelerin konu/kazanım/soru/içerik sayılarını TEK seferde,
// ünite başına ayrı sorgu atmadan (gruplu toplu sorgularla) döner — tablo satırlarını
// doldurmak için kullanılıyor.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  if (!gradeId || !lessonId) {
    return NextResponse.json({ error: 'gradeId ve lessonId zorunlu' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: unitRows } = await supabase
    .from('units')
    .select('id, title, order_no')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .order('order_no');
  const units = (unitRows as { id: number; title: string }[] | null) || [];
  if (!units.length) return NextResponse.json({ units: [] });

  const unitIds = units.map((u) => u.id);
  const { data: topicRows } = await supabase.from('topics').select('id, unit_id').in('unit_id', unitIds);
  const topics = (topicRows as { id: number; unit_id: number }[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  const topicToUnit = new Map(topics.map((t) => [t.id, t.unit_id]));

  // Satır sayısı 1000'i geçebilir (PostgREST sınırı) — sorular DB'de sayılır, diğerleri sayfalı okunur.
  const [outcomeRows, questionCountByTopic, contentRows] = topicIds.length
    ? await Promise.all([
        fetchAllRows<{ topic_id: number }>((from, to) => supabase.from('outcomes').select('topic_id').in('topic_id', topicIds).order('id').range(from, to)),
        getQuestionCountsByTopicId(supabase, topicIds),
        fetchAllRows<{ topic_id: number }>((from, to) => supabase.from('topic_contents').select('topic_id').in('topic_id', topicIds).order('id').range(from, to)),
      ])
    : [[], new Map<number, number>(), []];

  const topicCountByUnit = new Map<number, number>();
  for (const t of topics) topicCountByUnit.set(t.unit_id, (topicCountByUnit.get(t.unit_id) || 0) + 1);

  const outcomeCountByUnit = new Map<number, number>();
  for (const r of outcomeRows) {
    const unitId = topicToUnit.get(r.topic_id);
    if (unitId != null) outcomeCountByUnit.set(unitId, (outcomeCountByUnit.get(unitId) || 0) + 1);
  }

  const questionCountByUnit = new Map<number, number>();
  for (const [topicId, count] of questionCountByTopic) {
    const unitId = topicToUnit.get(topicId);
    if (unitId != null) questionCountByUnit.set(unitId, (questionCountByUnit.get(unitId) || 0) + count);
  }

  const contentCountByUnit = new Map<number, number>();
  for (const r of contentRows) {
    const unitId = topicToUnit.get(r.topic_id);
    if (unitId != null) contentCountByUnit.set(unitId, (contentCountByUnit.get(unitId) || 0) + 1);
  }

  const summary: UnitSummary[] = units.map((u) => ({
    id: u.id,
    title: u.title,
    topicCount: topicCountByUnit.get(u.id) || 0,
    outcomeCount: outcomeCountByUnit.get(u.id) || 0,
    questionCount: questionCountByUnit.get(u.id) || 0,
    contentCount: contentCountByUnit.get(u.id) || 0,
  }));

  return NextResponse.json({ units: summary });
}
