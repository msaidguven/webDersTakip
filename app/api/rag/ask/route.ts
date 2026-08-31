import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { answerQuestionForBook } from '@/app/src/lib/rag/answerQuestion';

// Öğrenci bir sınıf+ders (kitap) için soru sorar. Cevap Gemini ile üretilip
// doğrudan yayınlanır (admin onayı beklemez) ve öğrenciye hemen gösterilir —
// yanında "bu cevap yapay zekayla üretildi, hata içerebilir" uyarısı ve hatalı/
// eksik bulunursa bildirme imkânı sunulur (bkz. /api/rag/report).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { gradeId?: unknown; lessonId?: unknown; question?: unknown } | null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : Number(body?.gradeId);
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : Number(body?.lessonId);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: 'Soru boş olamaz' }, { status: 400 });
  if (question.length > 1000) return NextResponse.json({ error: 'Soru çok uzun' }, { status: 400 });

  const service = createServiceClient();

  const { data: lessonGrade } = await service
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!lessonGrade) return NextResponse.json({ error: 'Sınıf/ders bulunamadı' }, { status: 404 });

  let result;
  try {
    result = await answerQuestionForBook(service, gradeId, lessonId, question);
  } catch (err) {
    console.error('RAG soru-cevap hatası', err);
    return NextResponse.json({ error: 'Cevap üretilemedi, lütfen tekrar deneyin' }, { status: 500 });
  }

  const { data: saved, error: insertError } = await service
    .from('rag_answers')
    .insert({
      grade_id: gradeId,
      lesson_id: lessonId,
      student_id: user.id,
      question,
      answer: result.answer,
      matched_chunk_ids: result.matchedChunkIds,
      model: result.model,
      status: 'published',
    })
    .select('id')
    .single();

  if (insertError || !saved) {
    return NextResponse.json({ error: insertError?.message || 'Soru kaydedilemedi' }, { status: 500 });
  }

  return NextResponse.json({
    id: saved.id,
    answer: result.answer,
  });
}
