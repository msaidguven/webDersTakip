import { createPublicClient } from '@/utils/supabase/public';
import { notFound } from 'next/navigation';
import UnitTopicsClient from './UnitTopicsClient';

export const dynamic = 'force-dynamic';

interface Params {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

interface GradeRow {
  id: number;
  name: string;
  slug: string;
}

interface LessonRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

interface UnitRow {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  lesson_id: number;
}

interface TopicRow {
  id: number;
  title: string;
  slug: string;
  order_no: number;
  question_count: number;
}

export async function generateMetadata({ params }: { params: Params }) {
  const supabase = createPublicClient();
  
  const [{ data: grade }, { data: lesson }, { data: unit }] = await Promise.all([
    supabase.from('grades').select('name').eq('slug', params.gradeSlug).single(),
    supabase.from('lessons').select('name').eq('slug', params.lessonSlug).single(),
    supabase.from('units').select('title').eq('slug', params.unitSlug).single(),
  ]);
  
  return {
    title: grade && lesson && unit 
      ? `${grade.name} ${lesson.name} ${unit.title} Konuları | Ders Takip` 
      : 'Ders Takip',
  };
}

export default async function UnitTopicsPage({ params }: { params: Params }) {
  const supabase = createPublicClient();
  
  // Grade'i slug ile çek
  const { data: gradeRow, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, slug')
    .eq('slug', params.gradeSlug)
    .single();

  if (gradeError || !gradeRow) {
    console.error('[UnitTopicsPage] Grade bulunamadi:', gradeError);
    notFound();
  }
  const grade = gradeRow as unknown as GradeRow;

  // Lesson'ı slug ile çek
  const { data: lessonRow, error: lessonError } = await supabase
    .from('lessons')
    .select('id, name, slug, icon')
    .eq('slug', params.lessonSlug)
    .single();

  if (lessonError || !lessonRow) {
    console.error('[UnitTopicsPage] Lesson bulunamadi:', lessonError);
    notFound();
  }
  const lesson = lessonRow as unknown as LessonRow;

  // Unit'i slug ile çek
  const { data: unitRow, error: unitError } = await supabase
    .from('units')
    .select('id, title, slug, description, lesson_id')
    .eq('slug', params.unitSlug)
    .eq('lesson_id', lesson.id)
    .single();

  if (unitError || !unitRow) {
    console.error('[UnitTopicsPage] Unit bulunamadi:', unitError);
    notFound();
  }
  const unit = unitRow as unknown as UnitRow;

  // Bu unit'in bu grade'de olup olmadığını kontrol et
  const { data: unitGradeCheck } = await supabase
    .from('unit_grades')
    .select('unit_id')
    .eq('unit_id', unit.id)
    .eq('grade_id', grade.id)
    .single();

  if (!unitGradeCheck) {
    console.error('[UnitTopicsPage] Unit bu grade icin degil');
    notFound();
  }

  // Konuları çek
  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select('id, title, slug, order_no, question_count')
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .eq('order_status', 'approved')
    .order('order_no');

  if (topicsError) {
    console.error('[UnitTopicsPage] Topics sorgu hatasi:', topicsError);
  }

  const topics = (topicsData as TopicRow[]) || [];

  return (
    <UnitTopicsClient
      grade={grade}
      lesson={lesson}
      unit={unit}
      topics={topics}
      gradeSlug={params.gradeSlug}
      lessonSlug={params.lessonSlug}
      unitSlug={params.unitSlug}
    />
  );
}
