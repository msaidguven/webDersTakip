import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/utils/supabase/server-public';

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  grade_id: number;
  lesson_id: number;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};
type GradeRow = { id: number; slug: string | null };
type LessonRow = { id: number; slug: string | null };

export async function GET(request: NextRequest) {
  const lessonId = Number(request.nextUrl.searchParams.get('lesson_id'));
  const week = Number(request.nextUrl.searchParams.get('week'));

  if (!Number.isFinite(lessonId) || !Number.isFinite(week)) {
    return NextResponse.redirect(new URL('/', request.url), 302);
  }

  const supabase = createServerClient();

  const { data: unitsData } = await supabase
    .from('units')
    .select('id, title, slug, grade_id, lesson_id, order_no, start_week, end_week')
    .eq('lesson_id', lessonId)
    .eq('is_active', true)
    .order('grade_id', { ascending: true })
    .order('order_no', { ascending: true });

  const unit = ((unitsData as UnitRow[] | null) || []).find((row) => {
    const startWeek = row.start_week ?? 1;
    const endWeek = row.end_week ?? 52;
    return row.slug && week >= startWeek && week <= endWeek;
  });

  if (!unit?.slug) {
    return NextResponse.redirect(new URL('/', request.url), 302);
  }

  const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
    supabase.from('grades').select('id, slug').eq('id', unit.grade_id).maybeSingle(),
    supabase.from('lessons').select('id, slug').eq('id', unit.lesson_id).maybeSingle(),
  ]);

  const grade = gradeData as GradeRow | null;
  const lesson = lessonData as LessonRow | null;

  if (!grade?.slug || !lesson?.slug) {
    return NextResponse.redirect(new URL('/', request.url), 302);
  }

  const destination = new URL(`/${grade.slug}/${lesson.slug}/${unit.slug}/unite-testi`, request.url);
  return NextResponse.redirect(destination, 301);
}
