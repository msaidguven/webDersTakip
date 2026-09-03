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

// Yorumlar artık yayınlanmadan önce admin onayı beklemiyor (bkz. question_comments
// status default'u artık 'published' — migration: question_comments_auto_publish.sql).
// "review" bunun YERİNE geçen bir şey değil, EK bir şey: admin'in "bunu gördüm, göz
// attım" dediği, yayın durumunu değiştirmeyen ayrı bir işaret (kullanıcı isteği,
// 2026-09-04). reviewed_by/reviewed_at kolonları zaten vardı, publish/reject'in
// yan etkisi olarak yazılıyordu — burada TEK BAŞINA, status'a dokunmadan yazılıyor.
const REVIEW_ACTION = 'review';

// question_comments ("Yorumlar" görünümü) ve rag_answers ("AI'ye Sorulanlar") aynı
// publish/reject/delete/restore mekaniğini paylaşıyor (eski, tek-tablolu
// /api/admin/question-comments/[id]'in yerini alıyor; /api/admin/rag/qa/[id] hâlâ
// duruyor, ayrı bir amacı — hızlı "onay bekleyenler" listesi — var). delete'teki
// kademeli davranış öğrenci tarafındaki /api/comments/[id] ve /api/rag/answers/[id]
// ile birebir aynı.
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
  if (typeof action !== 'string' || (!(action in ACTION_TO_STATUS) && action !== REVIEW_ACTION)) {
    return NextResponse.json({ error: 'action "publish", "reject", "delete", "restore" veya "review" olmalı' }, { status: 400 });
  }

  const table = kind === 'comment' ? 'question_comments' : 'rag_answers';
  const supabase = createServiceClient();

  if (action === REVIEW_ACTION) {
    const { error } = await supabase
      .from(table)
      .update({ reviewed_by: admin.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', recordId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reviewed: true });
  }

  const nextStatus = ACTION_TO_STATUS[action];
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
