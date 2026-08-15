// app/[gradeSlug]/[lessonSlug]/page.tsx
// Bu dosya, mevcut page.tsx'in YERİNİ ALIR. Eski page.tsx içeriği
// app/[gradeSlug]/[lessonSlug]/icerik/page.tsx dosyasına taşındı.

import { cache } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import { parseGradeSegment, getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import MufredatOverviewClient, { Unit } from '../../ders/Mufredatoverviewclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
}

interface PageProps {
  params: Promise<Params>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};
type TopicRow = { id: number; unit_id: number; title: string; slug: string | null; order_no: number };
type GradeRow = { id: number; name: string; order_no: number; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null; icon: string | null };
type LessonGradeRow = { lesson_id: number };
type GradeLessonOption = { id: number; name: string; slug: string | null; icon: string | null };

const getMufredatOverviewData = cache(async function getMufredatOverviewData(gradeSlug: string, lessonSlug: string) {
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();

  let grade: GradeRow | null = null;
  let lesson: LessonRow | null = null;

  const { data: gradeBySlug } = await supabase
    .from('grades')
    .select('id, name, order_no, slug')
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
        .select('id, name, order_no, slug')
        .eq(gradeOrderNo ? 'order_no' : 'id', gradeQueryValue)
        .maybeSingle();
      grade = gradeByFallback as GradeRow | null;
    }
  }

  const { data: lessonBySlug } = await supabase
    .from('lessons')
    .select('id, name, slug, icon')
    .eq('slug', decodedLessonSlug)
    .maybeSingle();
  lesson = lessonBySlug as LessonRow | null;

  if (!lesson) {
    const lessonId = Number(decodedLessonSlug);
    if (Number.isFinite(lessonId)) {
      const { data: lessonById } = await supabase
        .from('lessons')
        .select('id, name, slug, icon')
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

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  // Her ünite için konu listesi (sayı etiketi + doğrudan görünen liste)
  const unitIds = units.map((u) => u.id);
  let topicsByUnit: Record<number, { id: number; title: string; slug: string | null; order_no: number }[]> = {};
  if (unitIds.length > 0) {
    const { data: topicsData } = await supabase
      .from('topics')
      .select('id, unit_id, title, slug, order_no')
      .in('unit_id', unitIds)
      .eq('is_active', true)
      .order('order_no', { ascending: true });

    topicsByUnit = ((topicsData as TopicRow[] | null) || []).reduce((acc, t) => {
      if (!acc[t.unit_id]) acc[t.unit_id] = [];
      acc[t.unit_id].push({ id: t.id, title: t.title, slug: t.slug, order_no: t.order_no });
      return acc;
    }, {} as Record<number, { id: number; title: string; slug: string | null; order_no: number }[]>);
  }

  const unitsWithTopicCount: Unit[] = units.map((u) => ({
    ...u,
    topicCount: topicsByUnit[u.id]?.length ?? null,
    topics: topicsByUnit[u.id] ?? [],
  }));

  // Aynı sınıftaki diğer dersler (hızlı ders değiştirme menüsü için)
  const { data: lessonGradesData } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gId)
    .eq('is_active', true);

  const siblingLessonIds = ((lessonGradesData as LessonGradeRow[] | null) || []).map((lg) => lg.lesson_id);
  let gradeLessons: GradeLessonOption[] = [];
  if (siblingLessonIds.length) {
    const { data: siblingLessonsData } = await supabase
      .from('lessons')
      .select('id, name, slug, icon, order_no')
      .in('id', siblingLessonIds)
      .eq('is_active', true)
      .order('order_no', { ascending: true });
    gradeLessons = ((siblingLessonsData as (LessonRow & { order_no: number | null })[] | null) || []).map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      icon: l.icon,
    }));
  }

  return {
    gradeId: gId.toString(),
    lessonId: lId.toString(),
    gradeName: grade.name,
    lessonName: lesson.name,
    lessonIcon: lesson.icon,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    units: unitsWithTopicCount,
    totalWeeks,
    gradeLessons,
  };
});

export default async function LessonOverviewPage({ params, searchParams }: PageProps) {
  const { gradeSlug, lessonSlug } = await params;
  const sp = await searchParams;

  const data = await getMufredatOverviewData(gradeSlug, lessonSlug);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Ders bulunamadı.</p>
      </div>
    );
  }

  const rawHafta = sp.hafta;
  const hafta = Array.isArray(rawHafta)
    ? parseInt(rawHafta[0])
    : rawHafta
      ? parseInt(rawHafta)
      : getCurrentCurriculumWeek(data.totalWeeks);

  return (
    <MufredatOverviewClient
      gradeName={data.gradeName}
      lessonName={data.lessonName}
      lessonIcon={data.lessonIcon}
      gradeSlug={data.gradeSlug}
      lessonSlug={data.lessonSlug}
      gradeId={data.gradeId}
      lessonId={data.lessonId}
      units={data.units}
      currentWeek={hafta}
      totalWeeks={data.totalWeeks}
      gradeLessons={data.gradeLessons}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gradeSlug, lessonSlug } = await params;
  const data = await getMufredatOverviewData(gradeSlug, lessonSlug);

  if (!data) {
    return { title: 'Ders Bulunamadı' };
  }

  const unitTitles = data.units.map((u) => u.title).join(', ');
  const title = `${data.gradeName} ${data.lessonName} Müfredatı ve Üniteler`;
  const description = unitTitles
    ? `${data.gradeName} ${data.lessonName} dersi haftalık müfredatı: ${unitTitles}. Konu anlatımları ve testlerle çalış.`
    : `${data.gradeName} ${data.lessonName} dersi haftalık müfredatı, konu anlatımları ve testleri.`;
  const canonicalPath = `/${data.gradeSlug}/${data.lessonSlug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath },
  };
}