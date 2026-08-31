import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { answerQuestionForBook } from '@/app/src/lib/rag/answerQuestion';

// Admin panelindeki "Tekrar AI'ye gönder": aynı soruyu, aynı sınıf+ders için
// yeniden çalıştırır (arama + üretim baştan yapılır) ve tekrar yayınlar. Bu cevaba
// ait açık bildirimler varsa (bkz. rag_answer_reports) çözüldü sayılır — içerik
// zaten değişti.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const qaId = Number(id);
  if (!Number.isFinite(qaId)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('rag_answers')
    .select('id, grade_id, lesson_id, question')
    .eq('id', qaId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });

  let result;
  try {
    result = await answerQuestionForBook(supabase, existing.grade_id, existing.lesson_id, existing.question);
  } catch (err) {
    console.error('RAG yeniden üretim hatası', err);
    return NextResponse.json({ error: 'Cevap yeniden üretilemedi' }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('rag_answers')
    .update({
      answer: result.answer,
      matched_chunk_ids: result.matchedChunkIds,
      model: result.model,
      status: 'published',
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq('id', qaId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase
    .from('rag_answer_reports')
    .update({ status: 'resolved', resolved_by: admin.user.id, resolved_at: new Date().toISOString() })
    .eq('rag_answer_id', qaId)
    .eq('status', 'open');

  return NextResponse.json({ ok: true, answer: result.answer });
}
