// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/kavrama-testi/page.tsx
// Konunun (ana başlık) TÜM sorularını (alt başlık + konu geneli, questions.topic_id
// tek kaynak) kapsayan tek kavrama testi. Eskiden her alt başlığın kendi
// /kavrama-testi/[sectionSlug] sayfası vardı; artık tek, konu seviyesinde bir test var
// (bkz. [sectionSlug]/page.tsx, artık buraya kalıcı yönlendiriyor).

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { SITE_URL } from '@/app/src/lib/site';
import { getTopicTestQuestions, SECONDS_PER_QUESTION } from '@/app/src/lib/quizQuestions';
import { findResumableSession } from '@/app/src/lib/quizResume';
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

type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };
type UnitRow = { id: number; title: string; slug: string | null };
type TopicRow = { id: number; title: string; slug: string | null };

const getTopicTestPageData = cache(async function getTopicTestPageData(
  gradeSlug: string,
  lessonSlug: string,
  unitSlug: string,
  topicSlug: string
) {
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();
  const decodedTopicSlug = decodeURIComponent(topicSlug || '').trim();

  const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
    supabase.from('grades').select('id, name, slug').eq('slug', decodedGradeSlug).maybeSingle(),
    supabase.from('lessons').select('id, name, slug').eq('slug', decodedLessonSlug).maybeSingle(),
  ]);

  const grade = gradeData as GradeRow | null;
  const lesson = lessonData as LessonRow | null;
  if (!grade || !lesson) return null;

  const isAdmin = await isViewerAdmin(supabase);

  let unitQuery = supabase
    .from('units')
    .select('id, title, slug')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug);
  if (!isAdmin) unitQuery = unitQuery.eq('is_active', true);
  const { data: unitData } = await unitQuery.maybeSingle();
  const unit = unitData as UnitRow | null;
  if (!unit) return null;

  let topicQuery = supabase.from('topics').select('id, title, slug').eq('unit_id', unit.id).eq('slug', decodedTopicSlug);
  if (!isAdmin) topicQuery = topicQuery.eq('is_active', true);
  const { data: topicData } = await topicQuery.maybeSingle();
  const topic = topicData as TopicRow | null;
  if (!topic) return null;

  // Gerçek soru sayısı: questions.topic_id (section_id'si dolu ya da boş fark etmeksizin,
  // /api/topic-test-questions ile aynı ilişki).
  const { count: topicQuestionCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topic.id);
  const questionCount = topicQuestionCount ?? 0;

  if (!isAdmin && questionCount === 0) return null;

  return {
    gradeId: grade.id,
    lessonId: lesson.id,
    unitId: unit.id,
    topicId: topic.id,
    gradeName: grade.name,
    lessonName: lesson.name,
    unitTitle: unit.title,
    topicTitle: topic.title,
    questionCount,
    hasQuestions: questionCount > 0,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: unit.slug,
    topicSlug: topic.slug,
  };
});

function buildTopicPath(data: NonNullable<Awaited<ReturnType<typeof getTopicTestPageData>>>) {
  return `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

function buildTopicTestPath(data: NonNullable<Awaited<ReturnType<typeof getTopicTestPageData>>>) {
  return `${buildTopicPath(data)}/kavrama-testi`;
}

function buildBreadcrumbJsonLd(data: NonNullable<Awaited<ReturnType<typeof getTopicTestPageData>>>) {
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

function buildSeoText(data: NonNullable<Awaited<ReturnType<typeof getTopicTestPageData>>>) {
  const title = `${data.topicTitle} Kavrama Testi | ${data.gradeName} ${data.lessonName}`;
  const description = normalizeDescription(
    `${data.gradeName} ${data.lessonName} ${data.topicTitle} konusu için kavrama testi çöz; öğrendiklerini anında pekiştir.`
  );
  return { title, description };
}

function buildQuizJsonLd(data: NonNullable<Awaited<ReturnType<typeof getTopicTestPageData>>>) {
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

  let resumable = null;
  let userId: string | null = null;
  if (data.hasQuestions) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (user) resumable = await findResumableSession(supabase, user.id, data.unitId, data.topicId);
  }

  const initialQuestions = resumable ? resumable.questions : data.hasQuestions ? await getTopicTestQuestions(data.topicId, userId) : [];

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
        reloadEndpoint={`/api/topic-test-questions?topicId=${data.topicId}`}
        timeLimitSeconds={initialQuestions.length > 0 ? initialQuestions.length * SECONDS_PER_QUESTION : undefined}
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
