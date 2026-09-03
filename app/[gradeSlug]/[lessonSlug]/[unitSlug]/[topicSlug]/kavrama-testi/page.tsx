// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/kavrama-testi/page.tsx
// Konunun (ana başlık) TÜM sorularını (alt başlık + konu geneli, questions.topic_id
// tek kaynak) kapsayan tek kavrama testi. Eskiden her alt başlığın kendi
// /kavrama-testi/[sectionSlug] sayfası vardı; artık tek, konu seviyesinde bir test var
// (bkz. [sectionSlug]/page.tsx, artık buraya kalıcı yönlendiriyor).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import {
  getTopicTestPageData,
  buildTopicPath,
  buildQuestionBankPath,
  loadTopicQuizState,
} from '@/app/src/lib/quizPageData';
import QuizWithAsk from '@/app/src/components/QuizWithAsk';

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

export default async function TopicTestPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  const data = await getTopicTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    notFound();
  }

  const { resumable, initialQuestions, remainingQuestionIds, allCaughtUp } = await loadTopicQuizState(data);

  return (
    <>
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
        remainingQuestionIds={remainingQuestionIds}
        allCaughtUp={allCaughtUp}
        reloadEndpoint={`/api/topic-test-questions?topicId=${data.topicId}`}
        secondsPerQuestion={initialQuestions.length > 0 ? SECONDS_PER_QUESTION : undefined}
        resume={resumable ? { sessionId: resumable.sessionId, answers: resumable.answers } : null}
        questionBankPathBase={buildQuestionBankPath(data)}
      />
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  const data = await getTopicTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    return { title: 'Kavrama Testi Bulunamadı', robots: { index: false, follow: false } };
  }

  return {
    title: `${data.topicTitle} Kavrama Testi | ${data.gradeName} ${data.lessonName}`,
    // Sorular artık /soru-bankasi'nda indeksleniyor; bu sayfa artık SEO amaçlı değil,
    // sadece testi hızlıca çözmek için (kullanıcı kararı, 2026-09-03).
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  };
}
