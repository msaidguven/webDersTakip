// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/page.tsx
// Konu okuma sayfası — ünite ve konu, haftaya göre değil doğrudan slug'a göre bulunur.

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { parseGradeSegment, getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { getLessonWeekData } from '@/app/src/lib/lessonWeekData';
import { getCurriculumTermStartDate } from '@/app/src/lib/curriculumCalendar';
import { SITE_URL, stripHtml } from '@/app/src/lib/site';
import DersClient from '../../../../ders/DersClient';

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

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
  is_active: boolean;
};
type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };

function buildTopicPath(data: NonNullable<Awaited<ReturnType<typeof getTopicPageData>>>) {
  return `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

function buildBreadcrumbJsonLd(data: NonNullable<Awaited<ReturnType<typeof getTopicPageData>>>) {
  const topicPath = buildTopicPath(data);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: data.gradeName, item: `${SITE_URL}/${data.gradeSlug}` },
      { '@type': 'ListItem', position: 3, name: data.lessonName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}` },
      { '@type': 'ListItem', position: 4, name: data.unitName, item: `${SITE_URL}/${data.gradeSlug}/${data.lessonSlug}#${data.unitSlug}` },
      { '@type': 'ListItem', position: 5, name: data.topicTitle, item: `${SITE_URL}${topicPath}` },
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

function buildMetaDescription(data: NonNullable<Awaited<ReturnType<typeof getTopicPageData>>>, bodyText: string | null) {
  const prefix = `${data.topicTitle} konusu; ${data.gradeName} ${data.lessonName} ${data.unitName} ünitesi için`;
  const detail = bodyText
    ? ` ${bodyText}`
    : ' konu anlatımı, örnekler ve interaktif alıştırmalarla öğrenmeyi destekler.';
  return normalizeDescription(`${prefix}${detail}`);
}

const getTopicPageData = cache(async function getTopicPageData(gradeSlug: string, lessonSlug: string, unitSlug: string, topicSlug: string) {
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();
  const decodedTopicSlug = decodeURIComponent(topicSlug || '').trim();

  let grade: GradeRow | null = null;
  let lesson: LessonRow | null = null;

  const { data: gradeBySlug } = await supabase
    .from('grades')
    .select('id, name, slug')
    .eq('slug', decodedGradeSlug)
    .maybeSingle();
  grade = gradeBySlug as GradeRow | null;

  if (!grade) {
    const gradeOrderNo = parseGradeSegment(decodedGradeSlug);
    const gradeId = Number(decodedGradeSlug);
    const gradeQueryValue = gradeOrderNo ?? (Number.isFinite(gradeId) ? gradeId : null);

    if (gradeQueryValue) {
      const { data: gradeByFallback } = await supabase
        .from('grades')
        .select('id, name, slug')
        .eq(gradeOrderNo ? 'order_no' : 'id', gradeQueryValue)
        .maybeSingle();
      grade = gradeByFallback as GradeRow | null;
    }
  }

  const { data: lessonBySlug } = await supabase
    .from('lessons')
    .select('id, name, slug')
    .eq('slug', decodedLessonSlug)
    .maybeSingle();
  lesson = lessonBySlug as LessonRow | null;

  if (!lesson) {
    const lessonId = Number(decodedLessonSlug);
    if (Number.isFinite(lessonId)) {
      const { data: lessonById } = await supabase
        .from('lessons')
        .select('id, name, slug')
        .eq('id', lessonId)
        .maybeSingle();
      lesson = lessonById as LessonRow | null;
    }
  }

  if (!grade || !lesson) {
    return null;
  }

  const gId = grade.id;
  const lId = lesson.id;

  const isAdmin = await isViewerAdmin(supabase);

  const { data: lessonGradeData } = await supabase
    .from('lesson_grades')
    .select('is_active')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .maybeSingle();

  if (!isAdmin && (lessonGradeData as { is_active: boolean } | null)?.is_active === false) {
    return null;
  }

  let unitsQuery = supabase
    .from('units')
    .select('id, title, slug, order_no, start_week, end_week, is_active')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .order('order_no', { ascending: true });
  if (!isAdmin) unitsQuery = unitsQuery.eq('is_active', true);
  const { data: unitsData } = await unitsQuery;

  const units = (unitsData as UnitRow[] | null) || [];

  const activeUnit = units.find((u) => u.slug === decodedUnitSlug) ?? null;
  if (!activeUnit) {
    return null;
  }

  // "Ünite Testi" bağlantısı yalnızca gerçekten sorusu olan ünitelerde gösterilmeli;
  // sidebar üzerinden ünite değiştirmek sayfayı yeniden yüklemediği için bunu tüm
  // üniteler için tek seferde (topics -> questions.topic_id) hesaplayıp Unit'e ekliyoruz.
  // Admin için buton yanında gerçek soru sayısını da göstermek üzere ayrıca sayıyoruz.
  const unitIds = units.map((u) => u.id);
  const questionCountByUnit = new Map<number, number>();
  if (unitIds.length) {
    const { data: allTopicsData } = await supabase
      .from('topics')
      .select('id, unit_id')
      .in('unit_id', unitIds)
      .eq('is_active', true);
    const unitIdByTopicId = new Map(((allTopicsData as { id: number; unit_id: number }[] | null) || []).map((t) => [t.id, t.unit_id]));
    const topicIds = Array.from(unitIdByTopicId.keys());
    if (topicIds.length) {
      const { data: questionsData } = await supabase
        .from('questions')
        .select('id, topic_id')
        .in('topic_id', topicIds);
      for (const q of (questionsData as { id: number; topic_id: number }[] | null) || []) {
        const unitId = unitIdByTopicId.get(q.topic_id);
        if (unitId == null) continue;
        questionCountByUnit.set(unitId, (questionCountByUnit.get(unitId) ?? 0) + 1);
      }
    }
  }
  const unitsWithQuestionFlag = units.map((u) => {
    const testQuestionCount = questionCountByUnit.get(u.id) ?? 0;
    return { ...u, has_questions: testQuestionCount > 0, test_question_count: testQuestionCount };
  });

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  // Görüntüleme/ilerleme amaçlı temsili hafta: ünitenin haftaya denk gelen aralığı
  const unitStart = activeUnit.start_week ?? 1;
  const unitEnd = activeUnit.end_week ?? totalWeeks;
  const termStartDate = await getCurriculumTermStartDate(supabase);
  const suggestedWeek = getCurrentCurriculumWeek(totalWeeks, termStartDate);
  const week = Math.min(unitEnd, Math.max(unitStart, suggestedWeek));

  // Konu içeriğini (alt başlıklar, ders notu, kazanımlar) SUNUCU tarafında çekiyoruz
  // ki Google ve diğer arama motorları sayfayı ilk yüklemede tam içerikle görsün.
  const { outcomes, contents } = await getLessonWeekData(supabase, activeUnit.id, week, isAdmin);

  const activeTopic = contents.find((c) => c.slug === decodedTopicSlug) ?? null;
  if (!activeTopic) {
    return null;
  }

  const isDraft = activeUnit.is_active === false || (lessonGradeData as { is_active: boolean } | null)?.is_active === false;

  return {
    gradeId: gId.toString(),
    lessonId: lId.toString(),
    gradeName: grade.name,
    lessonName: lesson.name,
    unitName: activeUnit.title,
    outcomes,
    contents,
    units: unitsWithQuestionFlag,
    totalWeeks,
    week,
    termStartDate,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: activeUnit.slug,
    topicTitle: activeTopic.title,
    topicSlug: activeTopic.slug,
    isAdmin,
    isDraft,
  };
});

export default async function TopicPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;

  const data = await getTopicPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    notFound();
  }

  return (
    <>
      <script
        id="structured-data-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildBreadcrumbJsonLd(data)).replace(/</g, '\\u003c'),
        }}
      />
      {data.isAdmin && data.isDraft && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm text-center py-2 px-4">
          Taslak — bu ders/ünite şu anda yayında değil, sadece adminler görebiliyor.
        </div>
      )}
      <DersClient
        initialData={data}
        gradeId={data.gradeId}
        lessonId={data.lessonId}
        week={data.week}
      />
    </>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;
  const data = await getTopicPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    return { title: 'Konu Bulunamadı' };
  }

  const activeContent = data.contents.find((c) => c.slug === data.topicSlug);
  const firstSectionHtml = activeContent?.sections.find((s) => s.html)?.html || null;
  const bodyText = firstSectionHtml
    ? stripHtml(firstSectionHtml, 120)
    : activeContent?.content
      ? stripHtml(activeContent.content, 120)
      : null;
  const description = buildMetaDescription(data, bodyText);

  const title = `${data.topicTitle} — ${data.gradeName} ${data.lessonName}`;
  const canonicalPath = buildTopicPath(data);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

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
