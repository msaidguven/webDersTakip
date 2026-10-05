import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { formatTeacherGuideGuidance } from '@/app/src/lib/teacherGuide/teacherGuideGuidance';

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
        .select('topic_id, source_pages, recommended_hours, emphasis_notes, content_points, key_terms, examples, scope_notes, misconceptions, prerequisites, assessment_notes, updated_at')
        .in('topic_id', topicIds)
    : { data: [] };

  type NoteRow = Parameters<typeof formatTeacherGuideGuidance>[0] & { topic_id: number; updated_at: string };
  const noteByTopicId = new Map(((notesData as NoteRow[] | null) || []).map((n) => [n.topic_id, n]));

  // guidance: promptlara (RAG kaynak/sentez, nihai içerik) giden kılavuz bloğunun AYNISI —
  // admin AI'ların tam olarak ne gördüğünü buradan kontrol eder.
  const items = topics.map((t) => {
    const note = noteByTopicId.get(t.id);
    return {
      topicId: t.id,
      topicTitle: t.title,
      recommendedHours: note?.recommended_hours ?? null,
      emphasisNotes: note?.emphasis_notes ?? null,
      sourcePages: note?.source_pages ?? null,
      guidance: note ? formatTeacherGuideGuidance(note, 'full') : null,
      updatedAt: note?.updated_at ?? null,
    };
  });

  return NextResponse.json({ items });
}
