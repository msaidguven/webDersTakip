import GradeLessonsClient from './GradeLessonsClient';
import { createClient } from '@/utils/supabase/server';
import { parseGradeSegment } from '@/app/src/lib/routeParsing';
import { getGradeColor, getGradeDescription, getGradeIcon, getLessonColor } from '@/app/src/lib/homeMapping';
import { Grade, Lesson } from '@/app/src/models/homeTypes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GradeRow {
  id: number;
  name: string;
  order_no: number;
}

interface LessonRow {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  slug: string | null;
  order_no: number | null;
}

export default async function GradePage({ params }: { params: Promise<{ grade: string }> }) {
  const { grade: gradeSegment } = await params;
  const gradeId = parseGradeSegment(gradeSegment);

  if (!gradeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">URL formatı hatalı. Örnek: 5-sınıf</p>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: gradeData, error: gradeError }, { data: lessonsData, error: lessonsError }] =
    await Promise.all([
      supabase.from('grades').select('id, name, order_no').eq('id', gradeId).single(),
      supabase
        .from('lesson_grades')
        .select('lessons(id, name, icon, description, slug, order_no)')
        .eq('grade_id', gradeId)
        .eq('is_active', true),
    ]);

  if (gradeError) {
    console.error('[GradePage] Grade sorgu hatasi:', gradeError);
  }
  if (lessonsError) {
    console.error('[GradePage] Lessons sorgu hatasi:', lessonsError);
  }

  const gradeRow = gradeData as GradeRow | null;
  if (!gradeRow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Sinif bulunamadi.</p>
      </div>
    );
  }

  const grade: Grade = {
    id: gradeRow.id.toString(),
    level: gradeRow.order_no,
    name: gradeRow.name,
    description: getGradeDescription(gradeRow.order_no),
    icon: getGradeIcon(gradeRow.order_no),
    color: getGradeColor(gradeRow.order_no),
  };

  const lessonRows = (lessonsData || [])
    .map((item: { lessons: LessonRow[] | null }) => item.lessons?.[0] || null)
    .filter((lesson): lesson is LessonRow => Boolean(lesson));

  const lessons: Lesson[] = lessonRows.map((lesson, index) => ({
    id: lesson.id.toString(),
    gradeId: grade.id,
    name: lesson.name,
    description: lesson.description || '',
    icon: lesson.icon || '📘',
    color: getLessonColor(lesson.order_no ?? index),
    unitCount: 0,
    questionCount: 0,
    slug: lesson.slug,
  }));

  return <GradeLessonsClient grade={grade} lessons={lessons} />;
}
