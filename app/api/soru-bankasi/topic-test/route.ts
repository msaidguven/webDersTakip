// app/api/soru-bankasi/topic-test/route.ts
// Soru bankasının kendi client-side modalı (bkz. TestStatusCard.tsx) "Teste Başla/Devam Et"
// tıklandığında bunu çağırır — sayfa hiç navigasyon yapmadan (kullanıcının 2026-09-05
// isteği: URL sabit kalsın) QuizWithAsk'ı çalıştırmak için gereken TÜM veriyi tek istekte
// döner. Konu sayfasındaki test (DersClientCards.tsx useTopicTest) da bunu kullanır; veri
// fonksiyonları (getTopicTestPageData, loadTopicQuizState) quizPageData.ts'te tek yerde.
import { NextRequest, NextResponse } from 'next/server';
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

  // forceNew=1: kullanıcı "aynı ünitede yarım kalmış bir testin var" uyarısında "Yeni Test
  // Başlat"a bastı — eski (çakışan) oturum kapatılıp yeni test normal şekilde planlanır.
  const forceNew = request.nextUrl.searchParams.get('forceNew') === '1';
  const { resumable, conflict, initialQuestions, remainingQuestionIds, allCaughtUp } = await loadTopicQuizState(data, { forceNew });

  return NextResponse.json({
    gradeId: data.gradeId,
    lessonId: data.lessonId,
    unitId: data.unitId,
    topicId: data.topicId,
    scopeLabel: `${data.topicTitle} Kavrama Testi`,
    initialQuestions,
    remainingQuestionIds,
    allCaughtUp,
    conflict,
    resume: resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null,
    reloadEndpoint: `/api/topic-test-questions?topicId=${data.topicId}`,
    questionBankPathBase: buildQuestionBankPath(data),
  });
}
