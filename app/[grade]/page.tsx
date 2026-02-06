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

  // Grade bilgisini çek
  const { data: gradeData, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, order_no')
    .eq('id', gradeId)
    .single();

  if (gradeError) {
    console.error('[GradePage] Grade sorgu hatasi:', gradeError);
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

  // Dersleri çek - önce lesson_grades'ten lesson_id'leri al
  const { data: lessonGradesData, error: lessonGradesError } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gradeId)
    .eq('is_active', true);

  if (lessonGradesError) {
    console.error('[GradePage] LessonGrades sorgu hatasi:', lessonGradesError);
  }

  // lesson_id'leri al
  const lessonIds = lessonGradesData?.map(lg => lg.lesson_id) || [];
  
  // lessons tablosundan dersleri çek
  let lessonRows: LessonRow[] = [];
  if (lessonIds.length > 0) {
    const { data: lessonsData, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, name, icon, description, slug, order_no')
      .in('id', lessonIds)
      .eq('is_active', true)
      .order('order_no');
    
    if (lessonsError) {
      console.error('[GradePage] Lessons sorgu hatasi:', lessonsError);
    } else {
      lessonRows = (lessonsData as LessonRow[]) || [];
    }
  }

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
