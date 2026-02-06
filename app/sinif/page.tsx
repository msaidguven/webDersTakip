import GradeLessonsClient from '../[grade]/GradeLessonsClient';
import { createClient } from '@/utils/supabase/server';
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

export default async function SinifPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ sinif?: string; ders?: string; unite?: string; hafta?: string }> 
}) {
  const params = await searchParams;
  const sinifId = params.sinif ? parseInt(params.sinif, 10) : null;
  
  if (!sinifId || isNaN(sinifId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Geçersiz sınıf parametresi.</p>
      </div>
    );
  }

  const supabase = await createClient();

  // Sınıf bilgisini çek
  const { data: gradeData, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, order_no')
    .eq('id', sinifId)
    .single();

  if (gradeError || !gradeData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Sınıf bulunamadı.</p>
      </div>
    );
  }

  const gradeRow = gradeData as GradeRow;
  
  const grade: Grade = {
    id: gradeRow.id.toString(),
    level: gradeRow.order_no,
    name: gradeRow.name,
    description: getGradeDescription(gradeRow.order_no),
    icon: getGradeIcon(gradeRow.order_no),
    color: getGradeColor(gradeRow.order_no),
  };

  // Dersleri çek
  const { data: lessonGradesData } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', sinifId)
    .eq('is_active', true);

  const lessonIds = lessonGradesData?.map(lg => lg.lesson_id) || [];
  
  let lessonRows: LessonRow[] = [];
  if (lessonIds.length > 0) {
    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('id, name, icon, description, slug, order_no')
      .in('id', lessonIds)
      .eq('is_active', true)
      .order('order_no');
    
    lessonRows = (lessonsData as LessonRow[]) || [];
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
