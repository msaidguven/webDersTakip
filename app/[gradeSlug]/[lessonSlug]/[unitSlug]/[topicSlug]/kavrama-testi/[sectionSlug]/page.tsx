// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/kavrama-testi/[sectionSlug]/page.tsx
// Bir alt başlığa (section) özel kavrama testi — eski /ders/alt-baslik-test?sectionId=
// query-param sayfasının yerine geçen, SEO uyumlu (slug tabanlı, gerçek soru sayısına
// göre indexlenen) sürüm.

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { SITE_URL, slugifyHeading } from '@/app/src/lib/site';
import { getSectionTestQuestions } from '@/app/src/lib/quizQuestions';
import QuizClient from '@/app/src/components/QuizClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
  sectionSlug: string;
}

interface PageProps {
  params: Promise<Params>;
}

type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };
type UnitRow = { id: number; title: string; slug: string | null };
type TopicRow = { id: number; title: string; slug: string | null };
type TopicContentRow = { id: number };
type SectionRow = { id: number; heading: string; topic_content_id: number };

const getSectionTestPageData = cache(async function getSectionTestPageData(
  gradeSlug: string,
  lessonSlug: string,
  unitSlug: string,
  topicSlug: string,
  sectionSlug: string
) {
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();
  const decodedTopicSlug = decodeURIComponent(topicSlug || '').trim();

  const sectionIdMatch = /^(\d+)/.exec(sectionSlug || '');
  const sectionId = sectionIdMatch ? Number(sectionIdMatch[1]) : NaN;
  if (!Number.isFinite(sectionId)) return null;

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

  const { data: topicContentData } = await supabase
    .from('topic_contents')
    .select('id')
    .eq('topic_id', topic.id)
    .eq('is_published', true)
    .maybeSingle();
  const topicContent = topicContentData as TopicContentRow | null;
  if (!topicContent) return null;

  const { data: sectionData } = await supabase
    .from('topic_content_sections')
    .select('id, heading, topic_content_id')
    .eq('id', sectionId)
    .maybeSingle();
  const section = sectionData as SectionRow | null;
  if (!section || section.topic_content_id !== topicContent.id) return null;

  // Gerçek soru sayısı: questions.section_id (bu ilişki /api/section-test-questions ile
  // aynı; units.question_count gibi elle girilen bir alan olmadığı için burada güvenilir).
  const { count: sectionQuestionCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('section_id', section.id);
  const questionCount = sectionQuestionCount ?? 0;

  if (!isAdmin && questionCount === 0) return null;

  const canonicalSlug = `${section.id}-${slugifyHeading(section.heading) || 'test'}`;

  return {
    gradeId: grade.id,
    lessonId: lesson.id,
    gradeName: grade.name,
    lessonName: lesson.name,
    unitTitle: unit.title,
    topicTitle: topic.title,
    sectionId: section.id,
    sectionHeading: section.heading,
    questionCount,
    hasQuestions: questionCount > 0,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: unit.slug,
    topicSlug: topic.slug,
    requestedSlug: sectionSlug,
    canonicalSlug,
  };
});

function buildTopicPath(data: NonNullable<Awaited<ReturnType<typeof getSectionTestPageData>>>) {
  return `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

function buildSectionTestPath(data: NonNullable<Awaited<ReturnType<typeof getSectionTestPageData>>>) {
  return `${buildTopicPath(data)}/kavrama-testi/${data.canonicalSlug}`;
}

function buildExitHref(data: NonNullable<Awaited<ReturnType<typeof getSectionTestPageData>>>) {
  const anchor = slugifyHeading(data.sectionHeading) || 'giris';
  return `${buildTopicPath(data)}#${anchor}`;
}

function buildBreadcrumbJsonLd(data: NonNullable<Awaited<ReturnType<typeof getSectionTestPageData>>>) {
  const topicPath = buildTopicPath(data);
  const testPath = buildSectionTestPath(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 4, name: data.topicTitle, item: `${SITE_URL}${topicPath}` },
      { '@type': 'ListItem', position: 5, name: `${data.sectionHeading} Kavrama Testi`, item: `${SITE_URL}${testPath}` },
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

function buildSeoText(data: NonNullable<Awaited<ReturnType<typeof getSectionTestPageData>>>) {
  const title = `${data.sectionHeading} Kavrama Testi | ${data.topicTitle} - ${data.gradeName} ${data.lessonName}`;
  const description = normalizeDescription(
    `${data.gradeName} ${data.lessonName} ${data.topicTitle} konusundaki "${data.sectionHeading}" alt başlığı için kavrama testi çöz; öğrendiklerini anında pekiştir.`
  );
  return { title, description };
}

function buildQuizJsonLd(data: NonNullable<Awaited<ReturnType<typeof getSectionTestPageData>>>) {
  const path = buildSectionTestPath(data);
  const { title, description } = buildSeoText(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: 'tr-TR',
    educationalLevel: data.gradeName,
    about: data.sectionHeading,
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
    ...(data.questionCount ? { assesses: `${data.sectionHeading} — ${data.questionCount} soru` } : {}),
  };
}

export default async function SectionTestPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug, sectionSlug } = await params;
  const data = await getSectionTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug, sectionSlug);

  if (!data) {
    notFound();
  }

  if (data.requestedSlug !== data.canonicalSlug) {
    permanentRedirect(buildSectionTestPath(data));
  }

  const initialQuestions = data.hasQuestions ? await getSectionTestQuestions(data.sectionId) : [];

  return (
    <>
      {!data.hasQuestions && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu alt başlıkta henüz soru yok, sayfa şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}
      <script
        id="structured-data-section-test-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
      <script
        id="structured-data-section-test-quiz"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildQuizJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
      <QuizClient
        key={data.sectionId}
        scopeLabel={data.sectionHeading}
        exitHref={buildExitHref(data)}
        exitLabel="Konuya Dön"
        initialQuestions={initialQuestions}
        reloadEndpoint={`/api/section-test-questions?sectionId=${data.sectionId}`}
      />
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug, sectionSlug } = await params;
  const data = await getSectionTestPageData(gradeSlug, lessonSlug, unitSlug, topicSlug, sectionSlug);

  if (!data) {
    return { title: 'Kavrama Testi Bulunamadı' };
  }

  const path = buildSectionTestPath(data);
  const canonicalUrl = `${SITE_URL}${path}`;
  const { title, description } = buildSeoText(data);

  return {
    title,
    description,
    keywords: [
      `${data.sectionHeading} testi`,
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
