import { createPublicClient } from '@/utils/supabase/public';
import { notFound } from 'next/navigation';
import UnitTopicsClient from './UnitTopicsClient';

export const revalidate = 60;

// Statik export için tüm grade+lesson+unit kombinasyonlarını önceden belirle
export async function generateStaticParams() {
  const supabase = createPublicClient();
  
  // Tüm unit_grades kayıtlarını çek
  const { data: unitGrades } = await supabase
    .from('unit_grades')
    .select('unit_id, grade_id');
  
  if (!unitGrades || unitGrades.length === 0) {
    return [];
  }
  
  const unitIds = [...new Set(unitGrades.map(ug => ug.unit_id))];
  const gradeIds = [...new Set(unitGrades.map(ug => ug.grade_id))];
  
  // Unit bilgilerini çek
  const { data: units } = await supabase
    .from('units')
    .select('id, slug, lesson_id')
    .in('id', unitIds)
    .eq('is_active', true);
  
  // Grade slugsını çek
  const { data: grades } = await supabase
    .from('grades')
    .select('id, slug')
    .in('id', gradeIds);
  
  // Lesson slugsını çek
  const lessonIds = [...new Set((units || []).map(u => u.lesson_id))];
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, slug')
    .in('id', lessonIds);
  
  const gradeMap = new Map((grades || []).map(g => [g.id, g.slug]));
  const lessonMap = new Map((lessons || []).map(l => [l.id, l.slug]));
  const unitMap = new Map((units || []).map(u => [u.id, { slug: u.slug, lesson_id: u.lesson_id }]));
  
  return unitGrades
    .filter(ug => {
      const unit = unitMap.get(ug.unit_id);
      const gradeSlug = gradeMap.get(ug.grade_id);
      const lessonSlug = unit ? lessonMap.get(unit.lesson_id) : undefined;
      return unit?.slug && gradeSlug && lessonSlug;
    })
    .map(ug => {
      const unit = unitMap.get(ug.unit_id)!;
      return {
        gradeSlug: gradeMap.get(ug.grade_id)!,
        lessonSlug: lessonMap.get(unit.lesson_id)!,
        unitSlug: unit.slug!,
      };
    });
}

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
