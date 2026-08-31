import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { answerQuestionFromTopic } from '@/app/src/lib/rag/answerQuestion';

// Öğrenci bir konu için soru sorar. Cevap Gemini ile üretilip veritabanına
// "pending" statüsüyle kaydedilir; admin onaylayana kadar öğrenciye gösterilmez
// (bu yüzden response'da answer alanı bilerek dönülmüyor).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { topicId?: unknown; question?: unknown } | null;
  const topicId = typeof body?.topicId === 'number' ? body.topicId : Number(body?.topicId);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';

  if (!Number.isFinite(topicId)) return NextResponse.json({ error: 'topicId gerekli' }, { status: 400 });
  if (!question) return NextResponse.json({ error: 'Soru boş olamaz' }, { status: 400 });
  if (question.length > 1000) return NextResponse.json({ error: 'Soru çok uzun' }, { status: 400 });

  const service = createServiceClient();

  const { data: topic } = await service.from('topics').select('id').eq('id', topicId).maybeSingle();
  if (!topic) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  let result;
  try {
    result = await answerQuestionFromTopic(service, topicId, question);
  } catch (err) {
    console.error('RAG soru-cevap hatası', err);
    return NextResponse.json({ error: 'Cevap üretilemedi, lütfen tekrar deneyin' }, { status: 500 });
  }

  const { data: saved, error: insertError } = await service
    .from('rag_answers')
    .insert({
      topic_id: topicId,
      student_id: user.id,
      question,
      answer: result.answer,
      matched_chunk_ids: result.matchedChunkIds,
      model: result.model,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !saved) {
    return NextResponse.json({ error: insertError?.message || 'Soru kaydedilemedi' }, { status: 500 });
  }

  return NextResponse.json({
    id: saved.id,
    message: 'Sorunuz alındı. İnceleme sonrası yayınlanacak.',
  });
}
