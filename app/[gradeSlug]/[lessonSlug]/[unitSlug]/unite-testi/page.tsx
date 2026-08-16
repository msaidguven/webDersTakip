import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { SITE_URL } from '@/app/src/lib/site';
import { getUnitTestQuestions } from '@/app/src/lib/quizQuestions';
import QuizClient from '@/app/src/components/QuizClient';

const UNIT_TEST_TIME_LIMIT_SECONDS = 3600;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };
type UnitRow = {
  id: number;
  title: string;
  description: string | null;
  slug: string | null;
  lesson_id: number;
  grade_id: number;
};
type TopicRow = { id: number; slug: string | null; order_no: number };

const getUnitTestPageData = cache(async function getUnitTestPageData(gradeSlug: string, lessonSlug: string, unitSlug: string) {
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();

  const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
    supabase.from('grades').select('id, name, slug').eq('slug', decodedGradeSlug).maybeSingle(),
    supabase.from('lessons').select('id, name, slug').eq('slug', decodedLessonSlug).maybeSingle(),
  ]);

  const grade = gradeData as GradeRow | null;
  const lesson = lessonData as LessonRow | null;
  if (!grade || !lesson) return null;

  const isAdmin = await isViewerAdmin(supabase);

  const { data: lessonGradeData } = await supabase
    .from('lesson_grades')
    .select('is_active')
    .eq('lesson_id', lesson.id)
    .eq('grade_id', grade.id)
    .maybeSingle();

  if (!isAdmin && (lessonGradeData as { is_active: boolean } | null)?.is_active === false) {
    return null;
  }

  let unitQuery = supabase
    .from('units')
    .select('id, title, description, slug, lesson_id, grade_id')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug);
  if (!isAdmin) unitQuery = unitQuery.eq('is_active', true);
  const { data: unitData } = await unitQuery.maybeSingle();

  const unit = unitData as UnitRow | null;
  if (!unit) return null;

  const { data: topicData, count: topicCount } = await supabase
    .from('topics')
    .select('id, slug, order_no', { count: 'exact' })
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const topicRows = (topicData as TopicRow[] | null) || [];
  const firstTopic = topicRows.find((topic) => topic.slug) || null;
  const exitHref = firstTopic?.slug
    ? `/${grade.slug}/${lesson.slug}/${unit.slug}/${firstTopic.slug}`
    : `/${grade.slug}/${lesson.slug}`;

  // Ünite testi sayfası yalnızca gerçekten sorusu olan ünitelerde gösterilmeli;
  // units.question_count elle girilen bir alan olduğu için burada gerçek soru
  // sayısını doğrudan topics -> questions.topic_id ilişkisinden hesaplıyoruz.
  const topicIds = topicRows.map((t) => t.id);
  let realQuestionCount = 0;
  if (topicIds.length) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('topic_id', topicIds);
    realQuestionCount = count ?? 0;
  }

  if (!isAdmin && realQuestionCount === 0) return null;

  return {
    gradeId: grade.id,
    lessonId: lesson.id,
    unitId: unit.id,
    gradeName: grade.name,
    lessonName: lesson.name,
    unitTitle: unit.title,
    unitDescription: unit.description,
    questionCount: realQuestionCount,
    topicCount: topicCount ?? null,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: unit.slug,
    exitHref,
    hasQuestions: realQuestionCount > 0,
  };
});

function buildUnitTestPath(data: NonNullable<Awaited<ReturnType<typeof getUnitTestPageData>>>) {
  return `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/unite-testi`;
}

function buildBreadcrumbJsonLd(data: NonNullable<Awaited<ReturnType<typeof getUnitTestPageData>>>) {
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

function buildSeoText(data: NonNullable<Awaited<ReturnType<typeof getUnitTestPageData>>>) {
  const title = `${data.unitTitle} Ünite Testi | ${data.gradeName} ${data.lessonName}`;
  const description = normalizeDescription(
    `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesi için online ünite testi çöz; konuları pekiştir, doğru-yanlış sonucunu anında gör.`
  );
  return { title, description };
}

function buildLearningResourceJsonLd(data: NonNullable<Awaited<ReturnType<typeof getUnitTestPageData>>>) {
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

  const initialQuestions = data.hasQuestions ? await getUnitTestQuestions(data.unitId) : [];

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
      <QuizClient
        key={data.unitId}
        scopeLabel={`${data.unitTitle} Ünite Testi`}
        exitHref={data.exitHref}
        exitLabel="Üniteye Dön"
        initialQuestions={initialQuestions}
        reloadEndpoint={`/api/unit-test-questions?unitId=${data.unitId}`}
        timeLimitSeconds={UNIT_TEST_TIME_LIMIT_SECONDS}
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
