import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';

// Bir sınıf+ders için üniteleri, her ünitenin ilk konusunun slug'ıyla birlikte döner.
// Anasayfa -> sınıf -> dersler sayfasında, ünite listesini (ünite sayfasına gitmeden)
// doğrudan orada gösterip her üniteye tıklandığında ilk konusuna link vermek için kullanılır.
type UnitRow = { id: number; title: string; slug: string | null; order_no: number };
type TopicRow = { id: number; unit_id: number; slug: string | null; order_no: number };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeId = Number(searchParams.get('gradeId'));
  const lessonId = Number(searchParams.get('lessonId'));

  if (![gradeId, lessonId].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Eksik veya hatalı parametre' }, { status: 400 });
  }

  const supabase = await createClient();
  const isAdmin = await isViewerAdmin(supabase);

  if (!isAdmin) {
    const { data: lessonGradeData } = await supabase
      .from('lesson_grades')
      .select('is_active')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .maybeSingle();
    if ((lessonGradeData as { is_active: boolean } | null)?.is_active === false) {
      return NextResponse.json({ units: [] });
    }
  }

  let unitsQuery = supabase
    .from('units')
    .select('id, title, slug, order_no')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .order('order_no', { ascending: true });
  if (!isAdmin) unitsQuery = unitsQuery.eq('is_active', true);
  const { data: unitsData } = await unitsQuery;

  const units = (unitsData as UnitRow[] | null) || [];
  const unitIds = units.map((u) => u.id);

  let firstTopicByUnit = new Map<number, TopicRow>();
  if (unitIds.length) {
    const { data: topicsData } = await supabase
      .from('topics')
      .select('id, unit_id, slug, order_no')
      .in('unit_id', unitIds)
      .eq('is_active', true)
      .order('order_no', { ascending: true });

    for (const t of (topicsData as TopicRow[] | null) || []) {
      if (!firstTopicByUnit.has(t.unit_id)) firstTopicByUnit.set(t.unit_id, t);
    }
  }

  const result = units.map((u) => ({
    id: u.id,
    title: u.title,
    slug: u.slug,
    orderNo: u.order_no,
    firstTopicSlug: firstTopicByUnit.get(u.id)?.slug ?? null,
  }));

  return NextResponse.json({ units: result });
}
