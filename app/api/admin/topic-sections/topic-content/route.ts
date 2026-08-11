import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { topicContentId?: number | string; subtitle?: string } | null;
  const topicContentId = body?.topicContentId;
  if (!topicContentId) {
    return NextResponse.json({ error: 'topicContentId gerekli' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('topic_contents')
    .update({ subtitle: typeof body?.subtitle === 'string' ? body.subtitle.trim() || null : null })
    .eq('id', topicContentId);

  if (error) {
    return NextResponse.json({ error: 'Kaydedilemedi' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
