import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { parseGradeSegment } from '@/app/src/lib/routeParsing';
import { getQuestionCountsByLessonGrade } from '@/app/src/lib/questionCounts';
import { getGradeColor, getGradeDescription, getGradeIcon } from '../src/lib/homeMapping';
import { Grade, Lesson } from '../src/models/homeTypes';
import GradePageClient from './GradePageClient';

// Bu sayfa taslak/admin önizlemesi göstermiyor (o iş /ders?... + admin paneli üzerinden
// yapılıyor) — tamamen public içerik, bu yüzden ISR ile cache'lenebiliyor. Konu
// sayfasındaki gibi generateStaticParams olmadan bu projede revalidate sessizce
// çalışmıyor (bkz. [topicSlug]/page.tsx'teki not).
export const revalidate = 3600;

interface Params {
  gradeSlug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return [];
}

type GradeRow = { id: number; name: string; order_no: number; slug: string | null };
type LessonGradeRow = { lesson_id: number; is_active: boolean };
type LessonRow = {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  slug: string | null;
  order_no: number | null;
};

function getLessonColor(orderNo: number): string {
  const colors = [
    'from-indigo-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-blue-500 to-cyan-500',
    'from-pink-500 to-rose-500',
  ];
  return colors[Math.abs(orderNo) % colors.length];
}

const getGradePageData = cache(async function getGradePageData(gradeSlug: string): Promise<{ grade: Grade | null; lessons: Lesson[] }> {
  const supabase = createAnonClient();
  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();

  const { data: gradeBySlug } = await supabase
    .from('grades')
    .select('id, name, order_no, slug')
    .eq('slug', decodedGradeSlug)
    .maybeSingle();

  let gradeData = gradeBySlug as GradeRow | null;

  if (!gradeData) {
    const gradeOrderNo = parseGradeSegment(decodedGradeSlug);
    const gradeId = Number(decodedGradeSlug);
    const gradeQueryValue = gradeOrderNo ?? (Number.isFinite(gradeId) ? gradeId : null);

    if (gradeQueryValue) {
      const { data: gradeByFallback } = await supabase
        .from('grades')
        .select('id, name, order_no, slug')
        .eq(gradeOrderNo ? 'order_no' : 'id', gradeQueryValue)
        .maybeSingle();
      gradeData = gradeByFallback as GradeRow | null;
    }
  }

  if (!gradeData) {
    return { grade: null, lessons: [] };
  }

  const grade: Grade = {
    id: String(gradeData.id),
    level: gradeData.order_no,
    name: gradeData.name,
    slug: gradeData.slug || `${gradeData.order_no}-sinif`,
    description: getGradeDescription(gradeData.order_no),
    icon: getGradeIcon(gradeData.order_no),
    color: getGradeColor(gradeData.order_no),
  };

  const { data: lessonGrades } = await supabase.from('lesson_grades').select('lesson_id, is_active').eq('grade_id', gradeData.id);

  const lessonGradeRows = (lessonGrades as LessonGradeRow[] | null) || [];
  const ids = lessonGradeRows.filter((row) => row.is_active).map((x) => x.lesson_id);

  if (!ids.length) {
    return { grade, lessons: [] };
  }

  const unitRowsQuery = supabase
    .from('units')
    .select('lesson_id')
    .eq('grade_id', gradeData.id)
    .in('lesson_id', ids)
    .eq('is_active', true);

  const [questionCountByLesson, { data: lessonRows }, { data: unitRows }] = await Promise.all([
    getQuestionCountsByLessonGrade(supabase, ids.map((lessonId) => ({ lessonId, gradeId: gradeData.id })), { activeOnly: true }),
    supabase
      .from('lessons')
      .select('id, name, icon, description, slug, order_no')
      .in('id', ids)
      .eq('is_active', true)
      .order('order_no'),
    unitRowsQuery,
  ]);

  const unitCountByLesson = new Map<number, number>();
  for (const u of (unitRows as { lesson_id: number }[] | null) || []) {
    unitCountByLesson.set(u.lesson_id, (unitCountByLesson.get(u.lesson_id) ?? 0) + 1);
  }

  const lessons: Lesson[] = ((lessonRows as LessonRow[] | null) || []).map((lesson) => ({
    id: String(lesson.id),
    gradeId: grade.id,
    name: lesson.name,
    description: lesson.description || '',
    icon: lesson.icon || '📘',
    color: getLessonColor(lesson.order_no ?? 0),
    unitCount: unitCountByLesson.get(lesson.id) ?? 0,
    questionCount: questionCountByLesson.get(`${lesson.id}:${gradeData.id}`) ?? 0,
    slug: lesson.slug,
  }));

  return { grade, lessons };
});

export default async function GradePage({ params }: { params: Promise<Params> }) {
  const { gradeSlug } = await params;
  const { grade, lessons } = await getGradePageData(gradeSlug);
  if (!grade) notFound();
  return <GradePageClient gradeSlug={gradeSlug} initialGrade={grade} initialLessons={lessons} />;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { gradeSlug } = await params;
  const { grade, lessons } = await getGradePageData(gradeSlug);

  if (!grade) {
    return { title: 'Sınıf Bulunamadı' };
  }

  const lessonNames = lessons.map((l) => l.name).join(', ');
  const title = `${grade.name} Konu Anlatımı ve Online Testler`;
  const description = lessonNames
    ? `${grade.name} için ${lessonNames} derslerinde haftalık müfredata uygun konu anlatımları ve interaktif testler.`
    : `${grade.name} için MEB müfredatına uygun konu anlatımları ve interaktif testler.`;
  const canonicalPath = `/${grade.slug}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath },
  };
}
