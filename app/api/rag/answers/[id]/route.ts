import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// Öğrenci kendi sorduğu "@ai" sorusunu siler. Gerçek bir DELETE değil —
// status='deleted' olur (yayından kalkar) ama kayıt durur, admin incelemesi
// için. Bu cevaba yapılmış yorumlar (question_comments.parent_ai_answer_id)
// da yayından kalkar.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const { id } = await params;
  const answerId = Number(id);
  if (!Number.isFinite(answerId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== 'delete') return NextResponse.json({ error: 'action "delete" olmalı' }, { status: 400 });

  const service = createServiceClient();

  const { data: answer } = await service.from('rag_answers').select('id, student_id, status').eq('id', answerId).maybeSingle();
  if (!answer) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
  if (answer.student_id !== user.id) return NextResponse.json({ error: 'Sadece kendi sorunu silebilirsin' }, { status: 403 });
  if (answer.status === 'deleted') return NextResponse.json({ error: 'Bu kayıt zaten silinmiş' }, { status: 400 });

  const { error } = await service.from('rag_answers').update({ status: 'deleted' }).eq('id', answerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await service.from('question_comments').update({ status: 'deleted' }).eq('parent_ai_answer_id', answerId);

  return NextResponse.json({ ok: true });
}
