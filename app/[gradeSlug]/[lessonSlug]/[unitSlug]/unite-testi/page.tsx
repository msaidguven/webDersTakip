import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import {
  getUnitTestPageData,
  loadUnitQuizState,
} from '@/app/src/lib/quizPageData';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export default async function UnitTestPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitTestPageData(gradeSlug, lessonSlug, unitSlug);

  if (!data) {
    notFound();
  }

  const { resumable, initialQuestions, remainingQuestionIds, allCaughtUp } = await loadUnitQuizState(data);

  return (
    <>
      {!data.hasQuestions && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu ünitede henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}
      <QuizWithAsk
        key={data.unitId}
        gradeId={data.gradeId}
        lessonId={data.lessonId}
        unitId={data.unitId}
        scopeLabel={`${data.unitTitle} Ünite Testi`}
        exitHref={data.exitHref}
        exitLabel="Üniteye Dön"
        initialQuestions={initialQuestions}
        remainingQuestionIds={remainingQuestionIds}
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
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitTestPageData(gradeSlug, lessonSlug, unitSlug);

  if (!data) {
    return { title: 'Ünite Testi Bulunamadı', robots: { index: false, follow: false } };
  }

  return {
    title: `${data.unitTitle} Ünite Testi | ${data.gradeName} ${data.lessonName}`,
    // Sorular artık /soru-bankasi'nda indeksleniyor; bu sayfa artık SEO amaçlı değil,
    // sadece testi hızlıca çözmek için (kullanıcı kararı, 2026-09-03).
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  };
}
