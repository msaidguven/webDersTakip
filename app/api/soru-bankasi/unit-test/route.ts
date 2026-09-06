// app/api/soru-bankasi/unit-test/route.ts
// Ünite testi için kardeş dosya — bkz. topic-test/route.ts.
import { NextRequest, NextResponse } from 'next/server';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import { getUnitTestPageData, loadUnitQuizState } from '@/app/src/lib/quizPageData';

export async function GET(request: NextRequest) {
  const gradeSlug = request.nextUrl.searchParams.get('gradeSlug');
  const lessonSlug = request.nextUrl.searchParams.get('lessonSlug');
  const unitSlug = request.nextUrl.searchParams.get('unitSlug');
  if (!gradeSlug || !lessonSlug || !unitSlug) {
    return NextResponse.json({ error: 'gradeSlug, lessonSlug, unitSlug gerekli' }, { status: 400 });
  }

  const data = await getUnitTestPageData(gradeSlug, lessonSlug, unitSlug);
  if (!data) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  // forceNew=1: kullanıcı "aynı ünitede yarım kalmış bir konu testin var" uyarısında "Yeni
  // Test Başlat"a bastı — eski (çakışan) oturum kapatılıp yeni test normal şekilde planlanır.
  const forceNew = request.nextUrl.searchParams.get('forceNew') === '1';
  const { resumable, conflict, initialQuestions, remainingQuestionIds, allCaughtUp } = await loadUnitQuizState(data, { forceNew });

  return NextResponse.json({
    gradeId: data.gradeId,
    lessonId: data.lessonId,
    unitId: data.unitId,
    scopeLabel: `${data.unitTitle} Ünite Testi`,
    initialQuestions,
    remainingQuestionIds,
    allCaughtUp,
    conflict,
    resume: resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null,
    reloadEndpoint: `/api/unit-test-questions?unitId=${data.unitId}`,
    secondsPerQuestion: initialQuestions.length > 0 ? SECONDS_PER_QUESTION : null,
    intro: {
      subLabel: `${data.gradeName} / ${data.lessonName}`,
      description: data.unitDescription,
      topicCount: data.topicCount,
      questionCount: data.questionCount,
    },
  });
}
