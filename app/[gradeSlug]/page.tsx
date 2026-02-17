import { createPublicClient } from '@/utils/supabase/public';
import { notFound } from 'next/navigation';
import GradeLessonsClient from './GradeLessonsClient';
import { getGradeColor, getGradeDescription, getGradeIcon, getLessonColor } from '@/app/src/lib/homeMapping';
import { Grade, Lesson } from '@/app/src/models/homeTypes';

export const dynamic = 'force-dynamic';

// Statik export için tüm grade slug'larını önceden belirle - build time'da çalışmazsa boş dön
export async function generateStaticParams() {
  const supabase = createPublicClient();
  const { data: grades } = await supabase
    .from('grades')
    .select('slug')
    .eq('is_active', true);
  
  return (grades || []).map((grade: { slug: string }) => ({
    gradeSlug: grade.slug,
  }));
}

interface GradeRow {
  id: number;
  name: string;
  order_no: number;
  slug: string;
}

interface LessonRow {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  slug: string | null;
  order_no: number | null;
}

interface Params {
  gradeSlug: string;
}

export async function generateMetadata({ params }: { params: Params }) {
  const supabase = createPublicClient();
  const { data: grade } = await supabase
    .from('grades')
    .select('name')
    .eq('slug', params.gradeSlug)
    .single();
  
  return {
    title: grade ? `${grade.name} Dersleri | Ders Takip` : 'Ders Takip',
    description: grade ? `${grade.name} tüm dersler ve üniteler` : 'Sınıf dersleri',
  };
}

export default async function GradePage({ params }: { params: Params }) {
  const supabase = createPublicClient();
  
  // Grade'i slug ile çek
  const { data: gradeRow, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, order_no, slug')
    .eq('slug', params.gradeSlug)
    .single();

  if (gradeError || !gradeRow) {
    console.error('[GradePage] Grade bulunamadi:', gradeError);
    notFound();
  }

  const gradeRowData = gradeRow as unknown as GradeRow;

  const grade: Grade = {
    id: gradeRowData.id.toString(),
    level: gradeRowData.order_no,
    name: gradeRowData.name,
    description: getGradeDescription(gradeRowData.order_no),
    icon: getGradeIcon(gradeRowData.order_no),
    color: getGradeColor(gradeRowData.order_no),
  };

  // Bu sınıftaki aktif dersleri çek
  const { data: lessonGradesData, error: lessonGradesError } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('grade_id', gradeRowData.id)
    .eq('is_active', true);

  if (lessonGradesError) {
    console.error('[GradePage] LessonGrades sorgu hatasi:', lessonGradesError);
  }

  const lessonIds = lessonGradesData?.map(lg => lg.lesson_id) || [];
  
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

  return <GradeLessonsClient grade={grade} lessons={lessons} gradeSlug={params.gradeSlug} />;
}
