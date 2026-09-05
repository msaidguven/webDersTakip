// app/api/soru-bankasi/topic-test/route.ts
// Soru bankasının kendi client-side modalı (bkz. TestStatusCard.tsx) "Teste Başla/Devam Et"
// tıklandığında bunu çağırır — sayfa hiç navigasyon yapmadan (kullanıcının 2026-09-05
// isteği: URL sabit kalsın) QuizWithAsk'ı çalıştırmak için gereken TÜM veriyi tek istekte
// döner. Gerçek konu kavrama testi sayfasıyla (kavrama-testi/page.tsx) VE panelin modalıyla
// (QuizModalContent.tsx) BİREBİR AYNI veri fonksiyonlarını (getTopicTestPageData,
// loadTopicQuizState) kullanır — davranış/kişiselleştirme/resume mantığı tekrar yazılmıyor.
import { NextRequest, NextResponse } from 'next/server';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import { getTopicTestPageData, loadTopicQuizState, buildQuestionBankPath } from '@/app/src/lib/quizPageData';

export async function GET(request: NextRequest) {
  const gradeSlug = request.nextUrl.searchParams.get('gradeSlug');
  const lessonSlug = request.nextUrl.searchParams.get('lessonSlug');
  const unitSlug = request.nextUrl.searchParams.get('unitSlug');
  const topicSlug = request.nextUrl.searchParams.get('topicSlug');
  if (!gradeSlug || !lessonSlug || !unitSlug || !topicSlug) {
    return NextResponse.json({ error: 'gradeSlug, lessonSlug, unitSlug, topicSlug gerekli' }, { status: 400 });
  }

  const data = await getTopicTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);
  if (!data) return NextResponse.json({ error: 'Konu bulunamadı' }, { status: 404 });

  const { resumable, initialQuestions, remainingQuestionIds, allCaughtUp } = await loadTopicQuizState(data);

  return NextResponse.json({
    gradeId: data.gradeId,
    lessonId: data.lessonId,
    unitId: data.unitId,
    topicId: data.topicId,
    scopeLabel: `${data.topicTitle} Kavrama Testi`,
    initialQuestions,
    remainingQuestionIds,
    allCaughtUp,
    resume: resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null,
    reloadEndpoint: `/api/topic-test-questions?topicId=${data.topicId}`,
    questionBankPathBase: buildQuestionBankPath(data),
    secondsPerQuestion: initialQuestions.length > 0 ? SECONDS_PER_QUESTION : null,
  });
}
