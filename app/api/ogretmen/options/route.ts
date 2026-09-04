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

  const supabase = createServiceClient();

  // Öğretmen artık ünite/konu kademeli TEK seçim değil, birden fazla üniteden birden
  // fazla konuyu birlikte işaretleyip tek Word'e alabiliyor — bu yüzden ünite+konu
  // ağacı tek seferde (nested) dönüyor, checklist UI'ı ayrı ayrı istek atmasın.
  if (gradeId && lessonId) {
    const { data: unitRows } = await supabase
      .from('units')
      .select('id, title')
      .eq('grade_id', gradeId)
      .eq('lesson_id', lessonId)
      .eq('is_active', true)
      .order('order_no', { ascending: true });
    const units = (unitRows as { id: number; title: string }[] | null) || [];
    if (!units.length) return NextResponse.json({ units: [] });

    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, title, unit_id')
      .in('unit_id', units.map((u) => u.id))
      .eq('is_active', true)
      .order('order_no', { ascending: true });
    const topicsByUnit = new Map<number, { id: number; title: string }[]>();
    ((topicRows as { id: number; title: string; unit_id: number }[] | null) || []).forEach((t) => {
      const list = topicsByUnit.get(t.unit_id) || [];
      list.push({ id: t.id, title: t.title });
      topicsByUnit.set(t.unit_id, list);
    });

    return NextResponse.json({
      units: units.map((u) => ({ id: u.id, title: u.title, topics: topicsByUnit.get(u.id) || [] })),
    });
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
