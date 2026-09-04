import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/app/src/lib/teacherAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğretmen panelindeki sınıf→ders→ünite→konu kademeli filtreyi besler. Tek route,
// hangi parametreler geldiğine göre bir sonraki seviyeyi döner — soru-bankası
// sayfalarındaki gibi ayrı ayrı statik route'lar yerine, burada trafik düşük
// (öğretmen kullanımı) olduğu için basit tutuldu.
export async function GET(request: NextRequest) {
  const teacher = await requireTeacher();
  if (!teacher.ok) return teacher.response;

  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const unitId = request.nextUrl.searchParams.get('unitId');

  const supabase = createServiceClient();

  if (unitId) {
    const { data } = await supabase
      .from('topics')
      .select('id, title')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('order_no', { ascending: true });
    return NextResponse.json({ topics: data || [] });
  }

  if (gradeId && lessonId) {
    const { data } = await supabase
      .from('units')
      .select('id, title')
      .eq('grade_id', gradeId)
      .eq('lesson_id', lessonId)
      .eq('is_active', true)
      .order('order_no', { ascending: true });
    return NextResponse.json({ units: data || [] });
  }

  if (gradeId) {
    // Bu sınıfta en az bir ünitesi olan dersler — hiç içeriği olmayan ders
    // filtrede gösterilmesin diye lessons tablosunu doğrudan değil, units
    // üzerinden dolaylı çekiyoruz.
    const { data: unitRows } = await supabase.from('units').select('lesson_id').eq('grade_id', gradeId).eq('is_active', true);
    const lessonIds = Array.from(new Set(((unitRows as { lesson_id: number }[] | null) || []).map((r) => r.lesson_id)));
    if (!lessonIds.length) return NextResponse.json({ lessons: [] });
    const { data } = await supabase.from('lessons').select('id, name').in('id', lessonIds).order('name', { ascending: true });
    return NextResponse.json({ lessons: data || [] });
  }

  const { data } = await supabase.from('grades').select('id, name').eq('is_active', true).order('order_no', { ascending: true });
  return NextResponse.json({ grades: data || [] });
}
