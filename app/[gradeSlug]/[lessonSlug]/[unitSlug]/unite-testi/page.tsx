import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { SITE_URL } from '@/app/src/lib/site';
import KarisikTestClient from '@/app/karisik-test/KarisikTestClient';

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
  question_count: number | null;
};
type TopicRow = { slug: string | null; order_no: number };

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
    .select('id, title, description, slug, lesson_id, grade_id, question_count')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug);
  if (!isAdmin) unitQuery = unitQuery.eq('is_active', true);
  const { data: unitData } = await unitQuery.maybeSingle();

  const unit = unitData as UnitRow | null;
  if (!unit) return null;

  const { data: topicData, count: topicCount } = await supabase
    .from('topics')
    .select('slug, order_no', { count: 'exact' })
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .order('order_no', { ascending: true })
    .limit(1);

  const firstTopic = ((topicData as TopicRow[] | null) || []).find((topic) => topic.slug) || null;
  const exitHref = firstTopic?.slug
    ? `/${grade.slug}/${lesson.slug}/${unit.slug}/${firstTopic.slug}`
    : `/${grade.slug}/${lesson.slug}`;

  return {
    gradeId: grade.id,
    lessonId: lesson.id,
    unitId: unit.id,
    gradeName: grade.name,
    lessonName: lesson.name,
    unitTitle: unit.title,
    unitDescription: unit.description,
    questionCount: unit.question_count ?? null,
    topicCount: topicCount ?? null,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: unit.slug,
    exitHref,
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

  return (
    <>
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
      <KarisikTestClient
        unitId={data.unitId}
        lessonId={data.lessonId}
        gradeId={data.gradeId}
        unitTitle={data.unitTitle}
        lessonName={data.lessonName}
        gradeName={data.gradeName}
        unitDescription={data.unitDescription}
        questionCount={data.questionCount}
        topicCount={data.topicCount}
        exitHref={data.exitHref}
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
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
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
