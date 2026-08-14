import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
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
type UnitRow = { id: number; title: string; slug: string | null; lesson_id: number; grade_id: number };
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

  const { data: unitData } = await supabase
    .from('units')
    .select('id, title, slug, lesson_id, grade_id')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug)
    .eq('is_active', true)
    .maybeSingle();

  const unit = unitData as UnitRow | null;
  if (!unit) return null;

  const { data: topicData } = await supabase
    .from('topics')
    .select('slug, order_no')
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
      <KarisikTestClient
        unitId={data.unitId}
        lessonId={data.lessonId}
        gradeId={data.gradeId}
        unitTitle={data.unitTitle}
        lessonName={data.lessonName}
        gradeName={data.gradeName}
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
  const title = `${data.unitTitle} Ünite Testi — ${data.gradeName} ${data.lessonName}`;
  const description = `${data.gradeName} ${data.lessonName} ${data.unitTitle} ünitesi için hazırlanmış online ünite testiyle konuları pekiştir, sonuçlarını anında gör.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
