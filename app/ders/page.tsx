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

  // Parallel queries
  const [
    { data: grade },
    { data: lesson },
  ] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gId).single(),
    supabase.from('lessons').select('name').eq('id', lId).single(),
  ]);

  // Kazanımları çek (RPC yoksa manuel sorgu)
  const { data: weekOutcomes } = await supabase
    .from('outcome_weeks')
    .select('outcome_id, start_week, end_week')
    .lte('start_week', CURRENT_WEEK)
    .gte('end_week', CURRENT_WEEK);

  let outcomes: any[] = [];
  let unitName = '';
  
  if (weekOutcomes?.length) {
    const outcomeIds = weekOutcomes.map((w: any) => w.outcome_id);
    const { data: outcomesData } = await supabase
      .from('outcomes')
      .select('id, description, topic_id, topics!inner(title, unit_id, units!inner(title, lesson_id))')
      .in('id', outcomeIds) as any;

    outcomes = (outcomesData || [])
      .filter((o: any) => o.topics?.units?.lesson_id === lId)
      .map((o: any) => ({
        id: o.id,
        description: o.description,
        topicTitle: o.topics?.title || '',
      }));

    // Ünite adını ilk kayıttan al
    const firstOutcome = outcomesData?.[0] as any;
    if (firstOutcome?.topics?.units?.title) {
      unitName = firstOutcome.topics.units.title;
    }
  }

  // Konu içeriklerini çek
  const { data: weekContents } = await supabase
    .from('topic_content_weeks')
    .select('topic_content_id')
    .eq('curriculum_week', CURRENT_WEEK);

  let contents: any[] = [];
  if (weekContents?.length) {
    const contentIds = weekContents.map((w: any) => w.topic_content_id);
    const { data: contentsData } = await supabase
      .from('topic_contents')
      .select('id, title, content, order_no, topic_id, topics!inner(unit_id, units!inner(lesson_id))')
      .in('id', contentIds)
      .order('order_no') as any;

    contents = (contentsData || [])
      .filter((c: any) => c.topics?.units?.lesson_id === lId)
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        orderNo: c.order_no,
      }));
  }

  return {
    gradeName: grade?.name || '',
    lessonName: lesson?.name || '',
    unitName,
    outcomes,
    contents,
  };
}

export default async function DersPage({ searchParams }: PageProps) {
  const gradeId = searchParams.grade_id as string;
  const lessonId = searchParams.lesson_id as string;

  if (!gradeId || !lessonId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Sinif veya ders bilgisi eksik</p>
      </div>
    );
  }

  const data = await getDersData(gradeId, lessonId);
  return <DersClient initialData={data} gradeId={gradeId} lessonId={lessonId} />;
}
