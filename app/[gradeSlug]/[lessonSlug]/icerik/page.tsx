// app/[gradeSlug]/[lessonSlug]/icerik/page.tsx
// Eski ?hafta= tabanlı URL'ler için geriye dönük uyumluluk: ilgili haftanın
// düştüğü üniteyi ve o ünitenin ilk konusunu bulup yeni slug tabanlı
// /[gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug] adresine yönlendirir.

import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { parseGradeSegment, getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';

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
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};
type TopicRow = { slug: string | null; order_no: number };
type GradeRow = { id: number; slug: string | null };
type LessonRow = { id: number; slug: string | null };

export default async function LegacyIcerikRedirectPage({ params, searchParams }: PageProps) {
  const { gradeSlug, lessonSlug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();

  let grade: GradeRow | null = null;
  const { data: gradeBySlug } = await supabase
    .from('grades')
    .select('id, slug')
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
        .select('id, slug')
        .eq(gradeOrderNo ? 'order_no' : 'id', gradeQueryValue)
        .maybeSingle();
      grade = gradeByFallback as GradeRow | null;
    }
  }

  let lesson: LessonRow | null = null;
  const { data: lessonBySlug } = await supabase
    .from('lessons')
    .select('id, slug')
    .eq('slug', decodedLessonSlug)
    .maybeSingle();
  lesson = lessonBySlug as LessonRow | null;

  if (!lesson) {
    const lessonId = Number(decodedLessonSlug);
    if (Number.isFinite(lessonId)) {
      const { data: lessonById } = await supabase
        .from('lessons')
        .select('id, slug')
        .eq('id', lessonId)
        .maybeSingle();
      lesson = lessonById as LessonRow | null;
    }
  }

  if (!grade || !lesson) {
    redirect(`/${gradeSlug}/${lessonSlug}`);
  }

  const { data: unitsData } = await supabase
    .from('units')
    .select('id, slug, order_no, start_week, end_week')
    .eq('lesson_id', lesson.id)
    .eq('grade_id', grade.id)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const units = (unitsData as UnitRow[] | null) || [];

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();
  const calendar = await getCurriculumCalendar(supabase);

  const rawHafta = sp.hafta;
  const week = Array.isArray(rawHafta)
    ? parseInt(rawHafta[0])
    : rawHafta
      ? parseInt(rawHafta)
      : getCurrentCurriculumWeek(totalWeeks, calendar.termStartDate, calendar.breaks);

  const activeUnit = units.find((u) => {
    const sw = u.start_week ?? 1;
    const ew = u.end_week ?? totalWeeks;
    return week >= sw && week <= ew;
  }) ?? units[0] ?? null;

  if (!activeUnit?.slug) {
    redirect(`/${gradeSlug}/${lessonSlug}`);
  }

  const { data: firstTopic } = await supabase
    .from('topics')
    .select('slug, order_no')
    .eq('unit_id', activeUnit.id)
    .eq('is_active', true)
    .order('order_no', { ascending: true })
    .limit(1)
    .maybeSingle();

  const topicSlug = (firstTopic as TopicRow | null)?.slug;
  if (!topicSlug) {
    redirect(`/${gradeSlug}/${lessonSlug}`);
  }

  redirect(`/${gradeSlug}/${lessonSlug}/${activeUnit.slug}/${topicSlug}`);
}
