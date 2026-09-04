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

// Kullanıcı isteği (2026-09-04): admin önce "Sil"le (yayından kaldırır, status='deleted',
// kayıt duruyor) — ama zaten silinmiş bir kaydı panelde artık kalıcı olarak da
// silebilsin ("önce sil diyerek işaretle, sonra kalıcı sil"). PURGE bu yüzden
// SADECE status zaten 'deleted' olan kayıtlarda çalışıyor; gerçek bir DB DELETE'tir,
// geri alınamaz.
const PURGE_ACTION = 'purge';

// question_comments ("Yorumlar" görünümü) ve rag_answers ("AI'ye Sorulanlar") aynı
// publish/reject/delete/restore mekaniğini paylaşıyor (eski, tek-tablolu
// /api/admin/question-comments/[id]'in yerini alıyor; /api/admin/rag/qa/[id] hâlâ
// duruyor, ayrı bir amacı — hızlı "onay bekleyenler" listesi — var). rag_answers'ı
// silme artık SADECE burada, admin'e özel — öğrenciler kendi sordukları soruyu
// (question_comments) silebilir ama AI'nin cevabını silemez (kullanıcı isteği,
// 2026-09-04); eski öğrenci-tarafı /api/rag/answers/[id] route'u bu yüzden kaldırıldı.
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
  if (typeof action !== 'string' || (!(action in ACTION_TO_STATUS) && action !== REVIEW_ACTION && action !== PURGE_ACTION)) {
    return NextResponse.json({ error: 'action "publish", "reject", "delete", "restore", "review" veya "purge" olmalı' }, { status: 400 });
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

  if (action === PURGE_ACTION) {
    const { data: record } = await supabase.from(table).select('status').eq('id', recordId).maybeSingle();
    if (!record) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
    if (record.status !== 'deleted') {
      return NextResponse.json({ error: 'Sadece önce silinmiş kayıtlar kalıcı olarak silinebilir' }, { status: 400 });
    }

    // rag_question_queue.comment_id -> question_comments(id) CASCADE değil; hâlâ
    // referans eden bir satır varsa hard delete FK hatasıyla başarısız olur.
    // Normalde soft-delete sırasında zaten temizleniyor (bkz. yukarıdaki 'delete'
    // dalı) — burada olası bir kalıntıya karşı best-effort bir daha temizleniyor.
    const commentIds = kind === 'comment' ? [recordId] : [];
    const parentColumn = kind === 'comment' ? 'parent_comment_id' : 'parent_ai_answer_id';
    const { data: children } = await supabase.from('question_comments').select('id').eq(parentColumn, recordId);
    commentIds.push(...((children as { id: number }[] | null) || []).map((c) => c.id));
    if (commentIds.length) await supabase.from('rag_question_queue').delete().in('comment_id', commentIds);

    const { error } = await supabase.from(table).delete().eq('id', recordId);
    if (error) return NextResponse.json({ error: `Kalıcı silinemedi: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, purged: true });
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
    // Silinen (ya da kademeli olarak yayından kaldırılan) bir yorum henüz
    // cevaplanmamış bir rag_question_queue satırına bağlıysa o satır da
    // temizlenmeli — yoksa worker daha sonra yine de cevaplar, kimsenin
    // göremeyeceği bir cevap üretip AI kotasını boşa harcar (bkz. öğrenci
    // tarafındaki aynı temizlik: /api/comments/[id], kullanıcı sorusu 2026-09-04).
    if (kind === 'comment') {
      const { data: children } = await supabase.from('question_comments').select('id').eq('parent_comment_id', recordId);
      const childIds = ((children as { id: number }[] | null) || []).map((c) => c.id);
      await supabase.from('rag_question_queue').delete().in('comment_id', [recordId, ...childIds]);
      await supabase.from('question_comments').update({ status: 'deleted' }).eq('parent_comment_id', recordId);
      await supabase.from('rag_answers').update({ status: 'deleted' }).eq('parent_comment_id', recordId);
    } else {
      const { data: children } = await supabase.from('question_comments').select('id').eq('parent_ai_answer_id', recordId);
      const childIds = ((children as { id: number }[] | null) || []).map((c) => c.id);
      if (childIds.length) await supabase.from('rag_question_queue').delete().in('comment_id', childIds);
      await supabase.from('question_comments').update({ status: 'deleted' }).eq('parent_ai_answer_id', recordId);
      await supabase.from('rag_answers').update({ status: 'deleted' }).eq('parent_rag_answer_id', recordId);
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
