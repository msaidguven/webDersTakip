import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

interface Params {
  draftId: string;
}

// Taslağın DURUMUNU günceller — sorular BURADAN kaydedilmez, admin tuttuğu soruları
// normal /api/admin/topic-sections/section/[sectionId]/questions rotasına (mevcut AI
// soru üretim akışıyla AYNI endpoint) kendisi gönderir; bu route sadece o işlemden
// SONRA (ya da tam red durumunda tek başına) taslağın durumunu işaretler
// (bkz. AiQuestionDraftsPanel.tsx — kullanıcının 2026-09-08 tasarladığı akış).
export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { draftId } = await params;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = body?.action;

  if (action !== 'reject' && action !== 'mark_saved' && action !== 'mark_saved_want_more') {
    return NextResponse.json({ error: 'Geçersiz action' }, { status: 400 });
  }

  const status = action === 'reject' ? 'rejected' : action === 'mark_saved' ? 'saved' : 'saved_want_more';

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('ai_question_drafts')
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: admin.user.id })
    .eq('id', draftId)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
