import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğretmen Kılavuzu sekmesindeki ünite ✅/⬜ ilerlemesi (TeacherGuideDocumentsPanel.tsx).
// Bir konu, kılavuzun AYRINTILI bilgisi (content_points) kayıtlıysa "yüklü" sayılır — 2026-10-04
// öncesinin yalnız vurgu notu içeren kayıtları sayılmaz, admin NotebookLM'le ünite ünite
// yeniden aktarırken kaldığı yeri bulabilsin diye.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));
  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: unitsData } = await supabase.from('units').select('id').eq('grade_id', gradeId).eq('lesson_id', lessonId);
  const unitIds = ((unitsData as { id: number }[] | null) || []).map((u) => u.id);
  if (!unitIds.length) return NextResponse.json({ items: [] });

  const { data: topicsData } = await supabase.from('topics').select('id, unit_id').in('unit_id', unitIds).eq('is_active', true);
  const topics = (topicsData as { id: number; unit_id: number }[] | null) || [];

  const { data: notesData, error } = topics.length
    ? await supabase
        .from('topic_teacher_guide_notes')
        .select('topic_id')
        .in('topic_id', topics.map((t) => t.id))
        .not('content_points', 'is', null)
    : { data: [], error: null };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const detailed = new Set(((notesData as { topic_id: number }[] | null) || []).map((n) => n.topic_id));
  const items = unitIds.map((unitId) => {
    const unitTopics = topics.filter((t) => t.unit_id === unitId);
    return { unitId, topicCount: unitTopics.length, detailedCount: unitTopics.filter((t) => detailed.has(t.id)).length };
  });

  return NextResponse.json({ items });
}
