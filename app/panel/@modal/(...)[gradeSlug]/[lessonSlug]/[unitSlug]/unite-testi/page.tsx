// Panelden "Test Çöz" / "Devam Et" (ünite testi) tıklanınca aynı /.../unite-testi URL'ini
// overlay olarak açan intercepting route. Bkz. kardeş dosya: .../kavrama-testi/page.tsx.

import { notFound } from 'next/navigation';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import { getUnitTestPageData, loadUnitQuizState } from '@/app/src/lib/quizPageData';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';
import QuizModal from '@/app/src/components/QuizModal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export default async function UnitTestModal({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitTestPageData(gradeSlug, lessonSlug, unitSlug);

  if (!data) {
    notFound();
  }

  const { resumable, initialQuestions, allCaughtUp } = await loadUnitQuizState(data);

  return (
    <QuizModal>
      <QuizWithAsk
        key={data.unitId}
        gradeId={data.gradeId}
        lessonId={data.lessonId}
        unitId={data.unitId}
        scopeLabel={`${data.unitTitle} Ünite Testi`}
        exitHref={data.exitHref}
        exitLabel="Üniteye Dön"
        initialQuestions={initialQuestions}
        allCaughtUp={allCaughtUp}
        reloadEndpoint={`/api/unit-test-questions?unitId=${data.unitId}`}
        secondsPerQuestion={initialQuestions.length > 0 ? SECONDS_PER_QUESTION : undefined}
        resume={resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null}
        intro={{
          subLabel: `${data.gradeName} / ${data.lessonName}`,
          description: data.unitDescription,
          topicCount: data.topicCount,
          questionCount: data.questionCount,
        }}
      />
    </QuizModal>
  );
}
