import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const MAX_LENGTH = 300;

// Öğrenci kendi yorumunu düzenler ya da "siler". Silme gerçek bir DELETE değil —
// status='deleted' olur (yayından kalkar) ama kayıt durur, şikayet/inceleme
// durumunda admin hâlâ görebilir. Bir üst yorum silinirse altındaki yanıtlar
// (başkaları yazmış olsa bile) da yayından kalkar.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isFinite(commentId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { action?: unknown; body?: unknown } | null;
  const action = body?.action;
  if (action !== 'edit' && action !== 'delete') {
    return NextResponse.json({ error: 'action "edit" veya "delete" olmalı' }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: comment } = await service
    .from('question_comments')
    .select('id, student_id, status, parent_comment_id')
    .eq('id', commentId)
    .maybeSingle();
  if (!comment) return NextResponse.json({ error: 'Yorum bulunamadı' }, { status: 404 });
  if (comment.student_id !== user.id) return NextResponse.json({ error: 'Sadece kendi yorumunu değiştirebilirsin' }, { status: 403 });
  if (comment.status === 'deleted') return NextResponse.json({ error: 'Bu yorum zaten silinmiş' }, { status: 400 });

  if (action === 'delete') {
    // Silinen yorum (ya da @hocam/@kanka'ya bir yanıt olarak yazılmış, kendi
    // AI sorusu olan bir alt yorum) henüz cevaplanmamış bir rag_question_queue
    // satırına bağlıysa, o satır da temizlenmeli — yoksa worker daha sonra
    // yine de cevaplar, kimsenin göremeyeceği (artık silinmiş yoruma bağlı)
    // bir cevap üretip AI kotasını boşa harcar, kullanıcıya da yanıtı hiçbir
    // yerde göremeyeceği bir "cevabın hazır" bildirimi gider (kullanıcı
    // sorusu, 2026-09-04). Kademeli silmedeki kapsamla aynı: sadece üst yorum
    // ve DOĞRUDAN altındaki yanıtlar (bkz. aşağıdaki cascade).
    const queueCommentIds = [commentId];
    if (comment.parent_comment_id == null) {
      const { data: children } = await service.from('question_comments').select('id').eq('parent_comment_id', commentId);
      queueCommentIds.push(...((children as { id: number }[] | null) || []).map((c) => c.id));
    }
    await service.from('rag_question_queue').delete().in('comment_id', queueCommentIds);

    const { error } = await service.from('question_comments').update({ status: 'deleted' }).eq('id', commentId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Üst yorumsa (parent_comment_id boşsa) altındaki yanıtlar (yorum ya da
    // @hocam/@kanka ile verilmiş AI cevapları) da yayından kalksın.
    if (comment.parent_comment_id == null) {
      await service.from('question_comments').update({ status: 'deleted' }).eq('parent_comment_id', commentId);
      await service.from('rag_answers').update({ status: 'deleted' }).eq('parent_comment_id', commentId);
    }

    return NextResponse.json({ ok: true });
  }

  // action === 'edit'
  const newBody = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_LENGTH) : '';
  if (!newBody) return NextResponse.json({ error: 'Yorum boş olamaz' }, { status: 400 });

  // İçerik değiştiği için, zaten yayınlanmış bir yorum tekrar admin onayına düşer.
  const nextStatus = comment.status === 'published' ? 'pending' : comment.status;

  const { error } = await service
    .from('question_comments')
    .update({ body: newBody, status: nextStatus, reviewed_by: null, reviewed_at: null })
    .eq('id', commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: nextStatus });
}
