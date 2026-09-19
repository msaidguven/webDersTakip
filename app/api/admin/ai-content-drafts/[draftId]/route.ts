import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

interface Params {
  draftId: string;
}

// ai_question_drafts'taki aynı çift-yazma önleme deseni: status güncellemesi ÖNCE, atomik
// olarak (pending -> saved/rejected) yapılır; panel bu isteğin claimed:true dönmesini
// bekleyip ANCAK ondan sonra gerçek yayınlama isteğini (topic-sections/plan) atar. İki
// sekmeden aynı taslağı aynı anda onaylamaya çalışmak bu sayede içeriği iki kez yayınlamaz.
export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { draftId } = await params;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = body?.action;

  if (action !== 'reject' && action !== 'mark_saved') {
    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
  }

  const status = action === 'reject' ? 'rejected' : 'saved';

  const supabase = createServiceClient();
  const { data: claimedRows, error } = await supabase
    .from('topic_section_content_drafts')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: admin.user.id })
    .eq('id', draftId)
    .eq('status', 'pending')
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const claimed = ((claimedRows as { id: number }[] | null) || []).length > 0;
  return NextResponse.json({ ok: true, claimed });
}
