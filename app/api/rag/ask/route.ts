import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { answerQuestionForBook } from '@/app/src/lib/rag/answerQuestion';
import { DAILY_QUESTION_LIMIT, countTodayQuestions } from '@/app/src/lib/rag/dailyLimit';

// Öğrenci bir sınıf+ders (kitap) için soru sorar. Cevap Gemini ile üretilip
// doğrudan yayınlanır (admin onayı beklemez) ve öğrenciye hemen gösterilir —
// yanında "bu cevap yapay zekayla üretildi, hata içerebilir" uyarısı ve hatalı/
// eksik bulunursa bildirme imkânı sunulur (bkz. /api/rag/report).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { gradeId?: unknown; lessonId?: unknown; unitId?: unknown; question?: unknown; questionContext?: unknown }
    | null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : Number(body?.gradeId);
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : Number(body?.lessonId);
  const unitIdRaw = typeof body?.unitId === 'number' ? body.unitId : Number(body?.unitId);
  const unitId = Number.isFinite(unitIdRaw) ? unitIdRaw : null;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const questionContext = typeof body?.questionContext === 'string' ? body.questionContext.trim().slice(0, 3000) : null;

  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId gerekli' }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: 'Soru boş olamaz' }, { status: 400 });
  if (question.length > 300) return NextResponse.json({ error: 'Soru çok uzun' }, { status: 400 });

  const service = createServiceClient();

  const { data: lessonGrade } = await service
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gradeId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (!lessonGrade) return NextResponse.json({ error: 'Sınıf/ders bulunamadı' }, { status: 404 });

  if (unitId != null) {
    const { data: unit } = await service
      .from('units')
      .select('id')
      .eq('id', unitId)
      .eq('grade_id', gradeId)
      .eq('lesson_id', lessonId)
      .maybeSingle();
    if (!unit) return NextResponse.json({ error: 'Ünite bu sınıf/derse ait değil' }, { status: 400 });
  }

  const askedToday = await countTodayQuestions(service, user.id);
  if (askedToday >= DAILY_QUESTION_LIMIT) {
    return NextResponse.json(
      { error: `Bugünkü soru hakkını (${DAILY_QUESTION_LIMIT}) doldurdun. Yarın tekrar sorabilirsin.` },
      { status: 429 }
    );
  }

  let result;
  try {
    result = await answerQuestionForBook(service, gradeId, lessonId, question, questionContext);
  } catch (err) {
    console.error('RAG soru-cevap hatası', err);
    return NextResponse.json({ error: 'Cevap üretilemedi, lütfen tekrar deneyin' }, { status: 500 });
  }

  const { data: saved, error: insertError } = await service
    .from('rag_answers')
    .insert({
      grade_id: gradeId,
      lesson_id: lessonId,
      unit_id: unitId,
      student_id: user.id,
      question,
      question_context: questionContext,
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

  // Cevap artık herkese açık bir "yorum" gibi gösterildiği için (bkz. /api/rag/unit-feed),
  // istemci yeni kaydı yeniden fetch etmeden hemen doğru isim/avatarla ekleyebilsin diye
  // soranın profil bilgisini de dönüyoruz.
  const { data: profile } = await service
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    id: saved.id,
    answer: result.answer,
    remaining: DAILY_QUESTION_LIMIT - askedToday - 1,
    profile: profile || null,
  });
}
