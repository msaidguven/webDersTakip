import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// action: 'unpublish' -> ilgili rag_answers.status='rejected' yapılır (yayından kalkar),
//         'dismiss'    -> sadece bildirim geçersiz sayılır, cevap yayında kalır.
// İkisi de bu bildirimi (ve aynı cevaba ait diğer açık bildirimleri) 'resolved' yapar.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isFinite(reportId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== 'unpublish' && action !== 'dismiss') {
    return NextResponse.json({ error: 'action "unpublish" veya "dismiss" olmalı' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: report } = await supabase
    .from('rag_answer_reports')
    .select('id, rag_answer_id')
    .eq('id', reportId)
    .maybeSingle();
  if (!report) return NextResponse.json({ error: 'Bildirim bulunamadı' }, { status: 404 });

  if (action === 'unpublish') {
    const { error: updateError } = await supabase
      .from('rag_answers')
      .update({ status: 'rejected', reviewed_by: admin.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', report.rag_answer_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { error: resolveError } = await supabase
    .from('rag_answer_reports')
    .update({ status: 'resolved', resolved_by: admin.user.id, resolved_at: new Date().toISOString() })
    .eq('rag_answer_id', report.rag_answer_id)
    .eq('status', 'open');
  if (resolveError) return NextResponse.json({ error: resolveError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
