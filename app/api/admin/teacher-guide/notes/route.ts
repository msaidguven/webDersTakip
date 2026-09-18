import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Admin panelde bir ünitenin konuları için hangi kılavuz notlarının zaten kayıtlı olduğunu
// göstermek için (TeacherGuideDocumentsPanel.tsx) — içerik üretim promptlarının/pacing
// hesabının okuduğu AYNI topic_teacher_guide_notes tablosu, sadece salt-okunur liste.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const unitId = Number(request.nextUrl.searchParams.get('unitId'));
  if (!Number.isFinite(unitId)) return NextResponse.json({ error: 'unitId gerekli' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title, order_no')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  const topics = (topicsData as { id: number; title: string; order_no: number | null }[] | null) || [];
  const topicIds = topics.map((t) => t.id);

  const { data: notesData } = topicIds.length
    ? await supabase
        .from('topic_teacher_guide_notes')
        .select('topic_id, recommended_hours, emphasis_notes, updated_at')
        .in('topic_id', topicIds)
    : { data: [] as { topic_id: number; recommended_hours: number | null; emphasis_notes: string | null; updated_at: string }[] };

  const noteByTopicId = new Map(
    ((notesData as { topic_id: number; recommended_hours: number | null; emphasis_notes: string | null; updated_at: string }[] | null) || []).map(
      (n) => [n.topic_id, n]
    )
  );

  const items = topics.map((t) => ({
    topicId: t.id,
    topicTitle: t.title,
    recommendedHours: noteByTopicId.get(t.id)?.recommended_hours ?? null,
    emphasisNotes: noteByTopicId.get(t.id)?.emphasis_notes ?? null,
    updatedAt: noteByTopicId.get(t.id)?.updated_at ?? null,
  }));

  return NextResponse.json({ items });
}
