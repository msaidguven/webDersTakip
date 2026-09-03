import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getDailyLimitFor, countTodayQuestions } from '@/app/src/lib/rag/dailyLimit';

// Öğrenci bir sınıf+ders (kitap) için soru sorar. Gemini'nin ücretsiz katmanının
// dakikalık istek limitine (aynı anda birden fazla öğrenci sorduğunda) çok çabuk
// takılması yüzünden (kullanıcı geri bildirimi, 2026-09-03) cevap artık BURADA,
// senkron üretilmiyor — soru rag_question_queue'ya yazılıp öğrenciye "kaydedildi,
// birazdan cevaplanacak" dönülüyor. Asıl Gemini çağrısı ve rag_answers'a yazma
// /api/rag/process-queue'da, GitHub Actions'ta 5 dakikada bir tetiklenen bir worker
// tarafından sırayla yapılıyor (bkz. o route'un başındaki not).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | {
        gradeId?: unknown;
        lessonId?: unknown;
        unitId?: unknown;
        quizQuestionId?: unknown;
        question?: unknown;
        questionContext?: unknown;
        mode?: unknown;
        parentCommentId?: unknown;
        parentRagAnswerId?: unknown;
      }
    | null;
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : Number(body?.gradeId);
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : Number(body?.lessonId);
  const unitIdRaw = typeof body?.unitId === 'number' ? body.unitId : Number(body?.unitId);
  const unitId = Number.isFinite(unitIdRaw) ? unitIdRaw : null;
  const quizQuestionIdRaw = typeof body?.quizQuestionId === 'number' ? body.quizQuestionId : Number(body?.quizQuestionId);
  const quizQuestionId = Number.isFinite(quizQuestionIdRaw) ? quizQuestionIdRaw : null;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const questionContext = typeof body?.questionContext === 'string' ? body.questionContext.trim().slice(0, 3000) : null;
  // "hocam": ders notuna bağlı, "kanka": serbest/genel bilgi de verebilen sohbet modu.
  const mode = body?.mode === 'kanka' ? 'kanka' : 'hocam';
  const parentCommentIdRaw = typeof body?.parentCommentId === 'number' ? body.parentCommentId : Number(body?.parentCommentId);
  const parentCommentId = Number.isFinite(parentCommentIdRaw) ? parentCommentIdRaw : null;
  const parentRagAnswerIdRaw = typeof body?.parentRagAnswerId === 'number' ? body.parentRagAnswerId : Number(body?.parentRagAnswerId);
  const parentRagAnswerId = Number.isFinite(parentRagAnswerIdRaw) ? parentRagAnswerIdRaw : null;

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

  if (quizQuestionId != null) {
    const { data: quizQuestion } = await service.from('questions').select('id').eq('id', quizQuestionId).maybeSingle();
    if (!quizQuestion) return NextResponse.json({ error: 'Test sorusu bulunamadı' }, { status: 400 });
  }

  if (parentCommentId != null && parentRagAnswerId != null) {
    return NextResponse.json({ error: 'Geçersiz yanıt hedefi' }, { status: 400 });
  }

  // Bir yoruma/önceki AI cevabına "yanıt" olarak soruluyorsa, o mesajın içeriğini
  // burada (istemciden değil, DB'den) çekip modele bağlam olarak veriyoruz — hem
  // güvenilir olsun hem de kayıtta doğru parent_* alanı set edilsin.
  let replyContext: string | null = null;
  if (parentCommentId != null) {
    const { data: parentComment } = await service
      .from('question_comments')
      .select('body')
      .eq('id', parentCommentId)
      .neq('status', 'deleted')
      .maybeSingle();
    if (!parentComment) return NextResponse.json({ error: 'Yanıt verilen yorum bulunamadı' }, { status: 400 });
    replyContext = parentComment.body as string;
  } else if (parentRagAnswerId != null) {
    const { data: parentAnswer } = await service
      .from('rag_answers')
      .select('question, answer')
      .eq('id', parentRagAnswerId)
      .neq('status', 'deleted')
      .maybeSingle();
    if (!parentAnswer) return NextResponse.json({ error: 'Yanıt verilen cevap bulunamadı' }, { status: 400 });
    replyContext = `Soru: ${parentAnswer.question}\nCevap: ${parentAnswer.answer}`;
  }

  const dailyLimit = await getDailyLimitFor(service, user.id);
  const askedToday = await countTodayQuestions(service, user.id);
  if (askedToday >= dailyLimit) {
    return NextResponse.json(
      { error: `Bugünkü soru hakkını (${dailyLimit}) doldurdun. Yarın tekrar sorabilirsin.` },
      { status: 429 }
    );
  }

  const { data: queued, error: insertError } = await service
    .from('rag_question_queue')
    .insert({
      student_id: user.id,
      grade_id: gradeId,
      lesson_id: lessonId,
      unit_id: unitId,
      quiz_question_id: quizQuestionId,
      question,
      question_context: questionContext,
      reply_context: replyContext,
      mode,
      parent_comment_id: parentCommentId,
      parent_rag_answer_id: parentRagAnswerId,
    })
    .select('id')
    .single();

  if (insertError || !queued) {
    return NextResponse.json({ error: insertError?.message || 'Soru kaydedilemedi' }, { status: 500 });
  }

  return NextResponse.json({
    queued: true,
    queueId: queued.id,
    remaining: dailyLimit - askedToday - 1,
  });
}
