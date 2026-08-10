// app/[gradeSlug]/[lessonSlug]/icerik/page.tsx
// Bu dosya, eski app/[gradeSlug]/[lessonSlug]/page.tsx dosyasının AYNISIDIR.
// Tek fark: klasör bir seviye derine indiği için DersClient import yolu güncellendi.

import { createClient } from '@/utils/supabase/server';
import { parseGradeSegment } from '@/app/src/lib/routeParsing';
import DersClient from '../../../ders/DersClient';

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


type ContentVM = { id: number; title: string; content: string | null; orderNo: number };
type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};
type TopicRow = { id: number; title: string; slug: string; order_no: number };
type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };

async function getDersDataBySlugs(gradeSlug: string, lessonSlug: string, week: number) {
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();

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

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  const activeUnit = units.find((u) => {
    const sw = u.start_week ?? 1;
    const ew = u.end_week ?? totalWeeks;
    return week >= sw && week <= ew;
  }) ?? units[0] ?? null;

  const unitId = activeUnit?.id ?? null;
  const unitName = activeUnit?.title ?? '';
  const unitSlug = activeUnit?.slug ?? null;

  const { data: topicsData } = unitId
    ? await supabase
        .from('topics')
        .select('id, title, slug, order_no')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('order_no', { ascending: true })
    : { data: null };

  const topics = (topicsData as TopicRow[] | null) || [];
  const activeTopic = topics[0] ?? null;

  const contents: ContentVM[] = topics
    .slice()
    .sort((a, b) => a.order_no - b.order_no)
    .map((t) => ({
      id: t.id,
      title: t.title,
      content: null,
      orderNo: t.order_no,
    }));

  return {
    gradeId: gId.toString(),
    lessonId: lId.toString(),
    gradeName: grade.name,
    lessonName: lesson.name,
    unitName,
    outcomes: [],
    contents,
    units,
    totalWeeks,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug,
    topicTitle: activeTopic?.title || null,
    topicSlug: activeTopic?.slug || null,
  };
}

export default async function LessonContentPage({ params, searchParams }: PageProps) {
  const { gradeSlug, lessonSlug } = await params;
  const sp = await searchParams;

  const rawHafta = sp.hafta;
  const hafta = Array.isArray(rawHafta) ? parseInt(rawHafta[0]) : (rawHafta ? parseInt(rawHafta) : 19);

  const data = await getDersDataBySlugs(gradeSlug, lessonSlug, hafta);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Ders bulunamadı.</p>
      </div>
    );
  }

  return (
    <DersClient
      initialData={data}
      gradeId={data.gradeId}
      lessonId={data.lessonId}
      week={hafta}
    />
  );
}