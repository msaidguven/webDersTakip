import { createClient } from '@/utils/supabase/server';
import DersClient from './DersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getDersData(sinifId: string, dersSlug: string) {
  const supabase = await createClient();
  const CURRENT_WEEK = 19;
  
  const gId = parseInt(sinifId);
  
  // Ders slug veya ID olabilir
  let lId: number | null = null;
  
  // Önce slug olarak dene
  const { data: lessonBySlug } = await supabase
    .from('lessons')
    .select('id')
    .eq('slug', dersSlug)
    .single();
    
  if (lessonBySlug) {
    lId = lessonBySlug.id;
  } else {
    // ID olarak dene
    lId = parseInt(dersSlug);
  }

  if (!lId || isNaN(lId)) {
    return { gradeName: '', lessonName: '', unitName: '', outcomes: [], contents: [] };
  }

  console.log('[getDersData] sinifId:', sinifId, 'dersSlug:', dersSlug, 'gId:', gId, 'lId:', lId);

  // Sınıf ve ders bilgisini çek
  const [
    { data: grade, error: gradeError },
    { data: lesson, error: lessonError },
  ] = await Promise.all([
    supabase.from('grades').select('name').eq('id', gId).single(),
    supabase.from('lessons').select('name').eq('id', lId).single(),
  ]);

  if (gradeError) console.error('[getDersData] Grade sorgu hatasi:', gradeError);
  if (lessonError) console.error('[getDersData] Lesson sorgu hatasi:', lessonError);

  // Kazanımları çek
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
      .select('id, description, topic_id, topics!inner(title, unit_id, units!inner(title, lesson_id, unit_grades!inner(grade_id)))')
      .in('id', outcomeIds) as any;

    const filteredOutcomesData = (outcomesData || []).filter((o: any) => 
      o.topics?.units?.lesson_id === lId && 
      o.topics?.units?.unit_grades?.some((ug: any) => ug.grade_id === gId)
    );

    outcomes = filteredOutcomesData.map((o: any) => ({
        id: o.id,
        description: o.description,
        topicTitle: o.topics?.title || '',
      }));

    const firstOutcome = filteredOutcomesData?.[0] as any;
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
      .select('id, title, content, order_no, topic_id, topics!inner(unit_id, units!inner(lesson_id, unit_grades!inner(grade_id)))')
      .in('id', contentIds)
      .order('order_no') as any;

    contents = (contentsData || [])
      .filter((c: any) => c.topics?.units?.lesson_id === lId && c.topics?.units?.unit_grades?.some((ug: any) => ug.grade_id === gId))
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
  const params = await searchParams;
  
  // Yeni parametre isimleri - ders_id de destekleniyor (geriye uyumluluk)
  const rawSinif = params.sinif;
  const rawDers = params.ders || params.ders_id;  // ders_id de kabul et
  const rawUnite = params.unite;
  const rawHafta = params.hafta;
  
  const sinifId = Array.isArray(rawSinif) ? rawSinif[0] : rawSinif;
  const dersSlug = Array.isArray(rawDers) ? rawDers[0] : rawDers;
  const uniteSlug = Array.isArray(rawUnite) ? rawUnite[0] : rawUnite;
  const hafta = Array.isArray(rawHafta) ? parseInt(rawHafta[0]) : (rawHafta ? parseInt(rawHafta) : 19);

  console.log('[DersPage] sinif:', sinifId, 'ders:', dersSlug, 'unite:', uniteSlug, 'hafta:', hafta);

  if (!sinifId || !dersSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Sınıf veya ders bilgisi eksik</p>
        <p className="text-xs text-gray-500 mt-2">sinif: {sinifId}, ders: {dersSlug}</p>
      </div>
    );
  }

  const data = await getDersData(sinifId, dersSlug);
  
  if (!data.gradeName || !data.lessonName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-2">Sınıf veya ders bulunamadı</p>
          <p className="text-xs text-gray-500">Sınıf: {sinifId}, Ders: {dersSlug}</p>
        </div>
      </div>
    );
  }
  
  return <DersClient initialData={data} gradeId={sinifId} lessonId={dersSlug} week={hafta} />;
}
