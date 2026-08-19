import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getQuestionCountsByTopicId } from '@/app/src/lib/questionCounts';

// Bir dersin (grade+lesson) TÜM ünitelerindeki TÜM konularının soru sayılarını tek
// istekte döner — ders sayfasında sağ sidebar'daki "Ünite Özeti" kartı, sayfa açıldıktan
// birkaç saniye sonra arka planda bunu çekip önbellekte tutar.
export async function GET(request: NextRequest) {
  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: unitsData } = await supabase
    .from('units')
    .select('id')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId);
  const unitIds = ((unitsData as { id: number }[] | null) || []).map((u) => u.id);
  if (!unitIds.length) {
    return NextResponse.json({ byTopic: {}, byUnit: {} });
  }

  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, unit_id')
    .in('unit_id', unitIds)
    .eq('is_active', true);
  const topics = (topicsData as { id: number; unit_id: number }[] | null) || [];

  const countsByTopicId = await getQuestionCountsByTopicId(supabase, topics.map((t) => t.id));

  const byTopic: Record<string, number> = {};
  const byUnit: Record<string, number> = {};
  for (const topic of topics) {
    const count = countsByTopicId.get(topic.id) ?? 0;
    byTopic[topic.id] = count;
    byUnit[topic.unit_id] = (byUnit[topic.unit_id] ?? 0) + count;
  }

  return NextResponse.json({ byTopic, byUnit });
}
