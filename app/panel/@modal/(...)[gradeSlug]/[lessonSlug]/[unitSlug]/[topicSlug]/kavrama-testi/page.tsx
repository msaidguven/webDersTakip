// Panelden "Soru Çöz" / "Devam Et" tıklanınca aynı /.../kavrama-testi URL'ini overlay olarak
// açan intercepting route. Gerçek (SEO'lu) sayfayla aynı veri/oturum mantığını
// (quizPageData.ts) kullanır — sadece JSON-LD/generateMetadata yok, o görev gerçek sayfada
// kalıyor. Doğrudan bu URL'e girilirse (yenileme, dışarıdan link) Next.js bu route'u değil,
// gerçek page.tsx'i render eder.

import { notFound } from 'next/navigation';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import { getTopicTestPageData, buildTopicPath, loadTopicQuizState } from '@/app/src/lib/quizPageData';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';
import QuizModal from '@/app/src/components/QuizModal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

export default async function TopicTestModal({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  const data = await getTopicTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    notFound();
  }

  const { resumable, initialQuestions, allCaughtUp } = await loadTopicQuizState(data);

  return (
    <QuizModal>
      <QuizWithAsk
        key={data.topicId}
        gradeId={data.gradeId}
        lessonId={data.lessonId}
        unitId={data.unitId}
        topicId={data.topicId}
        scopeLabel={`${data.topicTitle} Kavrama Testi`}
        exitHref={buildTopicPath(data)}
        exitLabel="Konuya Dön"
        initialQuestions={initialQuestions}
        allCaughtUp={allCaughtUp}
        reloadEndpoint={`/api/topic-test-questions?topicId=${data.topicId}`}
        secondsPerQuestion={initialQuestions.length > 0 ? SECONDS_PER_QUESTION : undefined}
        resume={resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null}
      />
    </QuizModal>
  );
}
