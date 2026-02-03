import { createClient } from '@/utils/supabase/server';
import DersClient from './DersClient';

// ISR for public lesson data
export const revalidate = 60;

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

async function getDersData(gradeId: string, lessonId: string) {
  const supabase = createClient();
  const CURRENT_WEEK = 19;
  
  const gId = parseInt(gradeId);
  const lId = parseInt(lessonId);

  // Parallel queries for better performance
  const [
    { data: grade },
    { data: lesson },
    { data: outcomes },
    { data: contents }
  ] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gId).single(),
    supabase.from('lessons').select('name').eq('id', lId).single(),
    // Use RPC for optimized query
    supabase.rpc('get_week_view_web', {
      p_lesson_id: lId,
      p_grade_id: gId,
      p_week_number: CURRENT_WEEK,
    }),
    supabase.rpc('web_get_topic_contents_for_week', {
      p_lesson_id: lId,
      p_grade_id: gId,
      p_week_number: CURRENT_WEEK,
    })
  ]);

  const unitName = outcomes?.[0]?.unit_title || '';

  return {
    gradeName: grade?.name || '',
    lessonName: lesson?.name || '',
    unitName,
    outcomes: outcomes || [],
    contents: contents || [],
  };
}

export default async function DersPage({ searchParams }: PageProps) {
  const gradeId = searchParams.grade_id as string;
  const lessonId = searchParams.lesson_id as string;

  if (!gradeId || !lessonId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Sınıf veya ders bilgisi eksik</p>
      </div>
    );
  }

  // Server-side fetch with caching
  const data = await getDersData(gradeId, lessonId);

  return <DersClient initialData={data} gradeId={gradeId} lessonId={lessonId} />;
}
