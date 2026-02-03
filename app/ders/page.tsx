import { createClient } from '@/utils/supabase/server';
import DersClient from './DersClient';

// Bu sayfa query parametrelerine bagli oldugu icin dinamik render edilmeli
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getDersData(gradeId: string, lessonId: string) {
  const supabase = await createClient();
  const CURRENT_WEEK = 19;
  
  const gId = parseInt(gradeId);
  const lId = parseInt(lessonId);

  console.log('[getDersData] gradeId:', gradeId, 'lessonId:', lessonId, 'gId:', gId, 'lId:', lId);

  // Parallel queries
  const [
    { data: grade, error: gradeError },
    { data: lesson, error: lessonError },
  ] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gId).single(),
    supabase.from('lesson_grades').select('lessons(name)').eq('grade_id', gId).eq('lesson_id', lId).single(),
  ]);

  if (gradeError) console.error('[getDersData] Grade sorgu hatasi:', gradeError);
  if (lessonError) console.error('[getDersData] Lesson sorgu hatasi:', lessonError);

  console.log('[getDersData] grade:', grade, 'lesson:', lesson);

  // Kazanımları çek (RPC yoksa manuel sorgu)
  const { data: weekOutcomes, error: weekOutcomesError } = await supabase
    .from('outcome_weeks')
    .select('outcome_id, start_week, end_week')
    .lte('start_week', CURRENT_WEEK)
    .gte('end_week', CURRENT_WEEK);

  if (weekOutcomesError) console.error('[getDersData] weekOutcomes sorgu hatasi:', weekOutcomesError);
  console.log('[getDersData] weekOutcomes:', weekOutcomes?.length || 0, 'kayit');

  let outcomes: any[] = [];
  let unitName = '';
  
  if (weekOutcomes?.length) {
    const outcomeIds = weekOutcomes.map((w: any) => w.outcome_id);
    console.log('[getDersData] outcomeIds:', outcomeIds);
    
    const { data: outcomesData, error: outcomesError } = await supabase
      .from('outcomes')
      .select('id, description, topic_id, topics!inner(title, unit_id, units!inner(title, lesson_id, unit_grades!inner(grade_id)))')
      .in('id', outcomeIds) as any;

    if (outcomesError) console.error('[getDersData] outcomes sorgu hatasi:', outcomesError);
    console.log('[getDersData] outcomesData:', outcomesData?.length || 0, 'kayit');

    outcomes = (outcomesData || [])
      .filter((o: any) => o.topics?.units?.lesson_id === lId && o.topics?.units?.unit_grades?.some((ug: any) => ug.grade_id === gId))
      .map((o: any) => ({
        id: o.id,
        description: o.description,
        topicTitle: o.topics?.title || '',
      }));

    console.log('[getDersData] filtered outcomes:', outcomes.length, 'kayit');

    // Ünite adını ilk kayıttan al
    const firstOutcome = outcomesData?.[0] as any;
    if (firstOutcome?.topics?.units?.title) {
      unitName = firstOutcome.topics.units.title;
    }
  }

  // Konu içeriklerini çek
  const { data: weekContents, error: weekContentsError } = await supabase
    .from('topic_content_weeks')
    .select('topic_content_id')
    .eq('curriculum_week', CURRENT_WEEK);

  if (weekContentsError) console.error('[getDersData] weekContents sorgu hatasi:', weekContentsError);
  console.log('[getDersData] weekContents:', weekContents?.length || 0, 'kayit');

  let contents: any[] = [];
  if (weekContents?.length) {
    const contentIds = weekContents.map((w: any) => w.topic_content_id);
    console.log('[getDersData] contentIds:', contentIds);
    
    const { data: contentsData, error: contentsError } = await supabase
      .from('topic_contents')
      .select('id, title, content, order_no, topic_id, topics!inner(unit_id, units!inner(lesson_id, unit_grades!inner(grade_id)))')
      .in('id', contentIds)
      .order('order_no') as any;

    if (contentsError) console.error('[getDersData] contents sorgu hatasi:', contentsError);
    console.log('[getDersData] contentsData:', contentsData?.length || 0, 'kayit');

    contents = (contentsData || [])
      .filter((c: any) => c.topics?.units?.lesson_id === lId && c.topics?.units?.unit_grades?.some((ug: any) => ug.grade_id === gId))
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        orderNo: c.order_no,
      }));
    
    console.log('[getDersData] filtered contents:', contents.length, 'kayit');
  }

  const result = {
    gradeName: grade?.name || '',
    lessonName: (lesson as any)?.lessons?.name || '',
    unitName,
    outcomes,
    contents,
  };
  
  console.log('[getDersData] SONUC:', result);
  return result;
}

export default async function DersPage({ searchParams }: PageProps) {
  // Next.js 15'te searchParams Promise olabilir
  const params = await searchParams;
  console.log('[DersPage] searchParams:', JSON.stringify(params));
  
  // Array kontrolü - searchParams değerleri string veya string[] olabilir
  const rawGradeId = params.grade_id;
  const rawLessonId = params.lesson_id;
  
  console.log('[DersPage] rawGradeId:', rawGradeId, 'type:', typeof rawGradeId);
  console.log('[DersPage] rawLessonId:', rawLessonId, 'type:', typeof rawLessonId);
  
  const gradeId = Array.isArray(rawGradeId) ? rawGradeId[0] : rawGradeId;
  const lessonId = Array.isArray(rawLessonId) ? rawLessonId[0] : rawLessonId;
  
  console.log('[DersPage] islenmis gradeId:', gradeId, 'lessonId:', lessonId);

  if (!gradeId || !lessonId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Sinif veya ders bilgisi eksik (URL parametreleri bulunamadi)</p>
      </div>
    );
  }

  const data = await getDersData(gradeId, lessonId);
  
  // DB'de kayit yoksa hata goster
  if (!data.gradeName || !data.lessonName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-2">Sinif veya ders bulunamadi</p>
          <p className="text-xs text-gray-500">Grade ID: {gradeId}, Lesson ID: {lessonId}</p>
        </div>
      </div>
    );
  }
  
  return <DersClient initialData={data} gradeId={gradeId} lessonId={lessonId} />;
}
