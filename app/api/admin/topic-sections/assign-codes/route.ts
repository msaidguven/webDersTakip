import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { computeMissingCodeAssignments } from '@/app/src/lib/outcomeCodes';

type OutcomeRow = { id: number; order_index: number | null; code: string | null };

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { topicId?: number | string } | null;
  const topicId = body?.topicId;
  if (!topicId) {
    return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, order_index, code')
    .eq('topic_id', topicId)
    .order('order_index', { ascending: true });

  const outcomes = (outcomesData as OutcomeRow[] | null) || [];
  const assignments = computeMissingCodeAssignments(outcomes);

  if (!assignments.length) {
    return NextResponse.json({ ok: true, assignedCount: 0 });
  }

  for (const assignment of assignments) {
    const { error } = await supabase
      .from('outcomes')
      .update({ code: assignment.code })
      .eq('id', assignment.id);
    if (error) {
      return NextResponse.json({ error: 'Kod ataması sırasında hata oluştu' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, assignedCount: assignments.length });
}
