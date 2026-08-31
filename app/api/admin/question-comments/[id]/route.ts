import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isFinite(commentId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== 'publish' && action !== 'reject') {
    return NextResponse.json({ error: 'action "publish" veya "reject" olmalı' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('question_comments')
    .update({
      status: action === 'publish' ? 'published' : 'rejected',
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', commentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
