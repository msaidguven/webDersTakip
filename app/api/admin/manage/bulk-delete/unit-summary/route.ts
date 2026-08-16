import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

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

  const [{ data: outcomeRows }, { data: usageRows }, { data: contentRows }] = topicIds.length
    ? await Promise.all([
        supabase.from('outcomes').select('topic_id').in('topic_id', topicIds),
        supabase.from('question_usages').select('topic_id, question_id').in('topic_id', topicIds),
        supabase.from('topic_contents').select('topic_id').in('topic_id', topicIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const topicCountByUnit = new Map<number, number>();
  for (const t of topics) topicCountByUnit.set(t.unit_id, (topicCountByUnit.get(t.unit_id) || 0) + 1);

  const outcomeCountByUnit = new Map<number, number>();
  for (const r of (outcomeRows as { topic_id: number }[] | null) || []) {
    const unitId = topicToUnit.get(r.topic_id);
    if (unitId != null) outcomeCountByUnit.set(unitId, (outcomeCountByUnit.get(unitId) || 0) + 1);
  }

  const questionIdsByUnit = new Map<number, Set<number>>();
  for (const r of (usageRows as { topic_id: number; question_id: number }[] | null) || []) {
    const unitId = topicToUnit.get(r.topic_id);
    if (unitId == null) continue;
    if (!questionIdsByUnit.has(unitId)) questionIdsByUnit.set(unitId, new Set());
    questionIdsByUnit.get(unitId)!.add(r.question_id);
  }

  const contentCountByUnit = new Map<number, number>();
  for (const r of (contentRows as { topic_id: number }[] | null) || []) {
    const unitId = topicToUnit.get(r.topic_id);
    if (unitId != null) contentCountByUnit.set(unitId, (contentCountByUnit.get(unitId) || 0) + 1);
  }

  const summary: UnitSummary[] = units.map((u) => ({
    id: u.id,
    title: u.title,
    topicCount: topicCountByUnit.get(u.id) || 0,
    outcomeCount: outcomeCountByUnit.get(u.id) || 0,
    questionCount: questionIdsByUnit.get(u.id)?.size || 0,
    contentCount: contentCountByUnit.get(u.id) || 0,
  }));

  return NextResponse.json({ units: summary });
}
