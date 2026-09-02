import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/app/src/lib/site';
import { SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import {
  getUnitTestPageData,
  buildUnitTestPath,
  loadUnitQuizState,
  type UnitTestPageData,
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

function buildBreadcrumbJsonLd(data: UnitTestPageData) {
  const path = buildUnitTestPath(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 4, name: data.unitTitle, item: data.exitHref ? `${SITE_URL}${data.exitHref}` : `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 5, name: `${data.unitTitle} Ünite Testi`, item: `${SITE_URL}${path}` },
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

function buildSeoText(data: UnitTestPageData) {
  const title = `${data.unitTitle} Ünite Testi | ${data.gradeName} ${data.lessonName}`;
  const description = normalizeDescription(
    `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesi için online ünite testi çöz; konuları pekiştir, doğru-yanlış sonucunu anında gör.`
  );
  return { title, description };
}

function buildLearningResourceJsonLd(data: UnitTestPageData) {
  const path = buildUnitTestPath(data);
  const { title, description } = buildSeoText(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: 'tr-TR',
    learningResourceType: 'Ünite testi',
    educationalLevel: data.gradeName,
    teaches: `${data.lessonName} - ${data.unitTitle}`,
    about: data.unitTitle,
    provider: {
      '@type': 'Organization',
      name: 'Ders Takip',
      url: SITE_URL,
    },
    isPartOf: {
      '@type': 'Course',
      name: `${data.gradeName} ${data.lessonName}`,
      url: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}`,
    },
    additionalProperty: [
      ...(data.topicCount
        ? [{ '@type': 'PropertyValue', name: 'Konu sayısı', value: data.topicCount }]
        : []),
      ...(data.questionCount
        ? [{ '@type': 'PropertyValue', name: 'Soru sayısı', value: data.questionCount }]
        : []),
    ],
  };
}

export default async function UnitTestPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitTestPageData(gradeSlug, lessonSlug, unitSlug);

  if (!data) {
    notFound();
  }

  const { resumable, initialQuestions, allCaughtUp } = await loadUnitQuizState(data);

  return (
    <>
      {!data.hasQuestions && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu ünitede henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}
      <script
        id="structured-data-unit-test-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
      <script
        id="structured-data-unit-test-learning-resource"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildLearningResourceJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
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
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug } = await params;
  const data = await getUnitTestPageData(gradeSlug, lessonSlug, unitSlug);

  if (!data) {
    return { title: 'Ünite Testi Bulunamadı' };
  }

  const path = buildUnitTestPath(data);
  const canonicalUrl = `${SITE_URL}${path}`;
  const { title, description } = buildSeoText(data);

  return {
    title,
    description,
    keywords: [
      `${data.unitTitle} ünite testi`,
      `${data.gradeName} ${data.lessonName} testi`,
      `${data.lessonName} online test`,
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
