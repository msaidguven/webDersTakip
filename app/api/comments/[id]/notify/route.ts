import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { buildContextResolver } from '@/app/src/lib/myComments';

const PREVIEW_LENGTH = 80;

// Kullanıcı isteği (2026-09-04): "kullanıcılar birbirlerine de cevap verdiklerinde
// bildirim gitsin". Yorum ekleme hâlâ istemci tarafında (RLS'li) yapılıyor
// (bkz. UnitDiscussion.tsx submitComment) — bu route yalnızca o eklemeden SONRA,
// fire-and-forget çağrılıp bildirimi oluşturuyor. Alıcı, yanıtlanan kaydın
// (üst yorum ya da AI cevabı) sahibi; kendi yorumuna/cevabına yanıt veren kişiye
// bildirim gitmiyor (self-notify yok). AI'nin kendi cevap bildirimi zaten
// /api/rag/process-queue'da ayrı üretiliyor, burası sadece insan-insan yanıtları içindir.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isFinite(commentId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const service = createServiceClient();

  const { data: comment } = await service
    .from('question_comments')
    .select('id, body, student_id, parent_comment_id, parent_ai_answer_id, question_id, unit_id')
    .eq('id', commentId)
    .maybeSingle();
  if (!comment) return NextResponse.json({ error: 'Yorum bulunamadı' }, { status: 404 });
  if (comment.student_id !== user.id) {
    return NextResponse.json({ error: 'Sadece kendi yorumun için bildirim tetikleyebilirsin' }, { status: 403 });
  }

  let recipientId: string | null = null;
  if (comment.parent_comment_id != null) {
    const { data: parent } = await service
      .from('question_comments')
      .select('student_id')
      .eq('id', comment.parent_comment_id)
      .maybeSingle();
    recipientId = parent?.student_id ?? null;
  } else if (comment.parent_ai_answer_id != null) {
    const { data: parent } = await service
      .from('rag_answers')
      .select('student_id')
      .eq('id', comment.parent_ai_answer_id)
      .maybeSingle();
    recipientId = parent?.student_id ?? null;
  }

  if (!recipientId || recipientId === user.id) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: replierProfile } = await service
    .from('profiles')
    .select('full_name, username')
    .eq('id', user.id)
    .maybeSingle();
  const replierLabel = replierProfile?.full_name || replierProfile?.username || 'Bir kullanıcı';

  const resolve = await buildContextResolver(service, [{ questionId: comment.question_id, unitId: comment.unit_id }]);
  const { href } = resolve({ questionId: comment.question_id, unitId: comment.unit_id });
  const link = href ? `${href}&yorum=c${comment.id}` : null;

  const preview = comment.body.length > PREVIEW_LENGTH ? `${comment.body.slice(0, PREVIEW_LENGTH)}…` : comment.body;

  const { error } = await service.from('notifications').insert({
    user_id: recipientId,
    type: 'comment_reply',
    title: `${replierLabel} yorumuna yanıt verdi`,
    body: preview,
    link,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
