// app/[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/page.tsx
// Konu okuma sayfası — ünite ve konu, haftaya göre değil doğrudan slug'a göre bulunur.

import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { parseGradeSegment, getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { getLessonWeekData } from '@/app/src/lib/lessonWeekData';
import { stripHtml } from '@/app/src/lib/site';
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
};
type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };

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

  const { data: unitsData } = await supabase
    .from('units')
    .select('id, title, slug, order_no, start_week, end_week')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const units = (unitsData as UnitRow[] | null) || [];

  const activeUnit = units.find((u) => u.slug === decodedUnitSlug) ?? null;
  if (!activeUnit) {
    return null;
  }

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  // Görüntüleme/ilerleme amaçlı temsili hafta: ünitenin haftaya denk gelen aralığı
  const unitStart = activeUnit.start_week ?? 1;
  const unitEnd = activeUnit.end_week ?? totalWeeks;
  const suggestedWeek = getCurrentCurriculumWeek(totalWeeks);
  const week = Math.min(unitEnd, Math.max(unitStart, suggestedWeek));

  // Konu içeriğini (alt başlıklar, ders notu, kazanımlar) SUNUCU tarafında çekiyoruz
  // ki Google ve diğer arama motorları sayfayı ilk yüklemede tam içerikle görsün.
  const { outcomes, contents } = await getLessonWeekData(supabase, activeUnit.id, week);

  const activeTopic = contents.find((c) => c.slug === decodedTopicSlug) ?? null;
  if (!activeTopic) {
    return null;
  }

  return {
    gradeId: gId.toString(),
    lessonId: lId.toString(),
    gradeName: grade.name,
    lessonName: lesson.name,
    unitName: activeUnit.title,
    outcomes,
    contents,
    units,
    totalWeeks,
    week,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: activeUnit.slug,
    topicTitle: activeTopic.title,
    topicSlug: activeTopic.slug,
  };
});

export default async function TopicPage({ params }: PageProps) {
  const { gradeSlug, lessonSlug, unitSlug, topicSlug } = await params;

  const data = await getTopicPageData(gradeSlug, lessonSlug, unitSlug, topicSlug);

  if (!data) {
    notFound();
  }

  return (
    <DersClient
      initialData={data}
      gradeId={data.gradeId}
      lessonId={data.lessonId}
      week={data.week}
    />
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
  const description = firstSectionHtml
    ? stripHtml(firstSectionHtml)
    : activeContent?.content
      ? stripHtml(activeContent.content)
      : `${data.gradeName} ${data.lessonName} dersi, ${data.unitName} ünitesi, ${data.topicTitle} konu anlatımı ve interaktif alıştırmalar.`;

  const title = `${data.topicTitle} — ${data.gradeName} ${data.lessonName}`;
  const canonicalPath = `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}
