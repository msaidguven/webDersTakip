import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getQuestionCountsByTopicId } from '@/app/src/lib/questionCounts';

// Bir dersin (grade+lesson) TÜM ünitelerindeki TÜM konularının soru sayılarını tek
// istekte döner — ders sayfasında sağ sidebar'daki "Ünite Özeti" kartı, sayfa açıldıktan
// birkaç saniye sonra arka planda bunu çekip önbellekte tutar.
export async function GET(request: NextRequest) {
  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonIdParam = request.nextUrl.searchParams.get('lessonId') || '';

  if (!Number.isFinite(gradeId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // DersClient bu isteği ders sayfasının kendi lessonId prop'uyla atıyor — o, sayfa slug
  // (ör. "sosyal-bilgiler") ile de ID ile de açılabildiği için (bkz. app/ders/page.tsx'teki
  // aynı çözümleme) burada da ikisi de kabul ediliyor. Eskiden sadece sayısal ID kabul
  // edilip slug'la her zaman 400 dönüyordu — "Ünite Özeti" kartı slug'lı ziyaretlerde hiç
  // çalışmıyordu (kullanıcının "ders sayfası yavaş" bildirimini araştırırken bulundu, 2026-09-02).
  let lessonId = Number(lessonIdParam);
  if (!Number.isFinite(lessonId)) {
    const { data: lessonBySlug } = await supabase.from('lessons').select('id').eq('slug', lessonIdParam).maybeSingle();
    lessonId = (lessonBySlug as { id: number } | null)?.id ?? NaN;
  }

  if (!Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

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

  const countsByTopicId = await getQuestionCountsByTopicId(supabase, topics.map((t) => t.id), { activeOnly: true });

  const byTopic: Record<string, number> = {};
  const byUnit: Record<string, number> = {};
  for (const topic of topics) {
    const count = countsByTopicId.get(topic.id) ?? 0;
    byTopic[topic.id] = count;
    byUnit[topic.unit_id] = (byUnit[topic.unit_id] ?? 0) + count;
  }

  return NextResponse.json({ byTopic, byUnit });
}
