import { createServerClient } from '@/utils/supabase/server-public';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LessonUnitsClient from './LessonUnitsClient';

export const dynamic = 'force-dynamic';

interface Params {
  gradeSlug: string;
  lessonSlug: string;
}

interface GradeRow {
  id: number;
  name: string;
  slug: string;
  order_no: number;
}

interface LessonRow {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface UnitRow {
  id: number;
  title: string;
  slug: string | null;
  description: string | null;
  order_no: number;
  question_count: number;
}

export async function generateMetadata({ params }: { params: Params }) {
  const supabase = createServerClient();
  
  const [{ data: grade }, { data: lesson }] = await Promise.all([
    supabase.from('grades').select('name').eq('slug', params.gradeSlug).single(),
    supabase.from('lessons').select('name').eq('slug', params.lessonSlug).single(),
  ]);
  
  return {
    title: grade && lesson ? `${grade.name} ${lesson.name} Üniteleri | Ders Takip` : 'Ders Takip',
  };
}

export default async function LessonUnitsPage({ params }: { params: Params }) {
  const supabase = createServerClient();
  
  // Grade'i slug ile çek
  const { data: gradeRow, error: gradeError } = await supabase
    .from('grades')
    .select('id, name, slug, order_no')
    .eq('slug', params.gradeSlug)
    .single();

  if (gradeError || !gradeRow) {
    console.error('[LessonUnitsPage] Grade bulunamadi:', gradeError);
    notFound();
  }

  const grade = gradeRow as unknown as GradeRow;

  // Lesson'ı slug ile çek
  const { data: lessonRow, error: lessonError } = await supabase
    .from('lessons')
    .select('id, name, slug, icon, description')
    .eq('slug', params.lessonSlug)
    .single();

  if (lessonError || !lessonRow) {
    console.error('[LessonUnitsPage] Lesson bulunamadi:', lessonError);
    notFound();
  }

  const lesson = lessonRow as unknown as LessonRow;

  // Bu lesson'ın bu grade'de aktif olup olmadığını kontrol et
  const { data: lessonGradeCheck } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('lesson_id', lesson.id)
    .eq('grade_id', grade.id)
    .eq('is_active', true)
    .single();

  if (!lessonGradeCheck) {
    console.error('[LessonUnitsPage] Lesson bu grade icin aktif degil');
    notFound();
  }

  // Üniteleri çek
  const { data: unitsData, error: unitsError } = await supabase
    .from('units')
    .select('id, title, slug, description, order_no, question_count')
    .eq('lesson_id', lesson.id)
    .eq('is_active', true)
    .order('order_no');

  if (unitsError) {
    console.error('[LessonUnitsPage] Units sorgu hatasi:', unitsError);
  }

  // Sadece bu grade'e ait üniteleri filtrele
  const allUnits = (unitsData as UnitRow[]) || [];
  const unitIds = allUnits.map(u => u.id);
  
  let filteredUnits: UnitRow[] = [];
  if (unitIds.length > 0) {
    const { data: unitGradesData } = await supabase
      .from('unit_grades')
      .select('unit_id')
      .eq('grade_id', grade.id)
      .in('unit_id', unitIds);
    
    const validUnitIds = new Set(unitGradesData?.map(ug => ug.unit_id) || []);
    filteredUnits = allUnits.filter(u => validUnitIds.has(u.id));
  }

  return (
    <LessonUnitsClient
      grade={grade}
      lesson={lesson}
      units={filteredUnits}
      gradeSlug={params.gradeSlug}
      lessonSlug={params.lessonSlug}
    />
  );
}
