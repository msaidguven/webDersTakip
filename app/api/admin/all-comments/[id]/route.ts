import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const ACTION_TO_STATUS: Record<string, string> = {
  publish: 'published',
  reject: 'rejected',
  delete: 'deleted',
  // "Geri Yükle": tekrar admin onayına düşer (pending) — doğrudan published'e almak,
  // silinmiş/reddedilmiş bir içeriği incelemeden tekrar canlıya almak anlamına gelirdi.
  restore: 'pending',
};

// question_comments ("Yorumlar" görünümü) ve rag_answers ("AI'ye Sorulanlar") aynı
// publish/reject/delete/restore mekaniğini paylaşıyor — /api/admin/question-comments/[id]
// ve /api/admin/rag/qa/[id]'nin birleşik hali. delete'teki kademeli davranış öğrenci
// tarafındaki /api/comments/[id] ve /api/rag/answers/[id] ile birebir aynı.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const recordId = Number(id);
  if (!Number.isFinite(recordId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { kind?: unknown; action?: unknown } | null;
  const kind = body?.kind;
  const action = body?.action;
  if (kind !== 'comment' && kind !== 'ai') {
    return NextResponse.json({ error: 'kind "comment" veya "ai" olmalı' }, { status: 400 });
  }
  if (typeof action !== 'string' || !(action in ACTION_TO_STATUS)) {
    return NextResponse.json({ error: 'action "publish", "reject", "delete" veya "restore" olmalı' }, { status: 400 });
  }

  const table = kind === 'comment' ? 'question_comments' : 'rag_answers';
  const nextStatus = ACTION_TO_STATUS[action];
  const supabase = createServiceClient();

  const patch: Record<string, unknown> = { status: nextStatus };
  if (action === 'publish' || action === 'reject') {
    patch.reviewed_by = admin.user.id;
    patch.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase.from(table).update(patch).eq('id', recordId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (action === 'delete') {
    if (kind === 'comment') {
      await supabase.from('question_comments').update({ status: 'deleted' }).eq('parent_comment_id', recordId);
      await supabase.from('rag_answers').update({ status: 'deleted' }).eq('parent_comment_id', recordId);
    } else {
      await supabase.from('question_comments').update({ status: 'deleted' }).eq('parent_ai_answer_id', recordId);
      await supabase.from('rag_answers').update({ status: 'deleted' }).eq('parent_rag_answer_id', recordId);
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
