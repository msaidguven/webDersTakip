// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/kavrama-testi/page.tsx
// Konunun (ana başlık) TÜM sorularını (alt başlık + konu geneli, questions.topic_id
// tek kaynak) kapsayan tek kavrama testi. Eskiden her alt başlığın kendi
// /kavrama-testi/[sectionSlug] sayfası vardı; artık tek, konu seviyesinde bir test var
// (bkz. [sectionSlug]/page.tsx, artık buraya kalıcı yönlendiriyor).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/app/src/lib/site';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import {
  getTopicTestPageData,
  buildTopicPath,
  buildTopicTestPath,
  loadTopicQuizState,
  type TopicTestPageData,
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

function buildBreadcrumbJsonLd(data: TopicTestPageData) {
  const topicPath = buildTopicPath(data);
  const testPath = buildTopicTestPath(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 4, name: data.topicTitle, item: `${SITE_URL}${topicPath}` },
      { '@type': 'ListItem', position: 5, name: `${data.topicTitle} Kavrama Testi`, item: `${SITE_URL}${testPath}` },
    ],
  };
}

function normalizeDescription(text: string, maxLength = 158) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, lastSpace > 120 ? lastSpace : sliced.length).trimEnd()}…`;
}

function buildSeoText(data: TopicTestPageData) {
  const title = `${data.topicTitle} Kavrama Testi | ${data.gradeName} ${data.lessonName}`;
  const description = normalizeDescription(
    `${data.gradeName} ${data.lessonName} ${data.topicTitle} konusu için kavrama testi çöz; öğrendiklerini anında pekiştir.`
  );
  return { title, description };
}

function buildQuizJsonLd(data: TopicTestPageData) {
  const path = buildTopicTestPath(data);
  const { title, description } = buildSeoText(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: 'tr-TR',
    educationalLevel: data.gradeName,
    about: data.topicTitle,
    isPartOf: {
      '@type': 'LearningResource',
      name: data.topicTitle,
      url: `${SITE_URL}${buildTopicPath(data)}`,
    },
    provider: {
      '@type': 'Organization',
      name: 'Ders Takip',
      url: SITE_URL,
    },
    ...(data.questionCount ? { assesses: `${data.topicTitle} — ${data.questionCount} soru` } : {}),
  };
}

export default async function TopicTestPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  const data = await getTopicTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    notFound();
  }

  const { resumable, initialQuestions, allCaughtUp } = await loadTopicQuizState(data);

  return (
    <>
      {!data.hasQuestions && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu konuda henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}
      <script
        id="structured-data-topic-test-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
      <script
        id="structured-data-topic-test-quiz"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildQuizJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
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
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  const data = await getTopicTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    return { title: 'Kavrama Testi Bulunamadı' };
  }

  const path = buildTopicTestPath(data);
  const canonicalUrl = `${SITE_URL}${path}`;
  const { title, description } = buildSeoText(data);

  return {
    title,
    description,
    keywords: [
      `${data.topicTitle} kavrama testi`,
      `${data.gradeName} ${data.lessonName} testi`,
      'ders takip',
    ],
    robots: {
      index: data.hasQuestions,
      follow: data.hasQuestions,
      googleBot: {
        index: data.hasQuestions,
        follow: data.hasQuestions,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'Ders Takip',
      locale: 'tr_TR',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
