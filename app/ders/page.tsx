import { createClient } from '@/utils/supabase/server';
import { markdownToHtml } from '@/app/src/lib/topicContentV11';
import { getCurrentCurriculumWeek } from '@/app/src/lib/routeParsing';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { getCurriculumTermStartDate } from '@/app/src/lib/curriculumCalendar';
import DersClient from './DersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type WeekOutcomeRow = { outcome_id: number; start_week: number; end_week: number };
type OutcomeRow = {
  id: number;
  description: string;
  topic_id?: number;
  topics?: {
    title?: string | null;
    units?: {
      title?: string | null;
      lesson_id?: number | null;
      grade_id?: number | null;
    } | null;
  } | null;
};

type OutcomeVM = { id: number; description: string; topicTitle: string };
type SectionVM = { id: number; heading: string; html: string | null; imageUrl: string | null; imagePrompt: string | null; diagramSvg: string | null };
type HighlightVM = { icon: string | null; title: string; description: string };
type ContentVM = {
  id: number;
  title: string;
  content: string | null;
  orderNo: number;
  sections: SectionVM[];
  heroImageUrl: string | null;
  subtitle: string | null;
  highlights: HighlightVM[];
};

type TopicContentRow = { id: number; topic_id: number; hero_image_url: string | null; subtitle: string | null };
type SectionRow = {
  id: number;
  topic_content_id: number;
  order_no: number;
  heading: string;
  body_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  diagram_svg: string | null;
};
type HighlightRow = {
  topic_content_id: number;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};

type TopicRow = { id: number; title: string; slug: string; order_no: number };

async function getDersData(sinifId: string, dersSlug: string, requestedWeek: number | null) {
  const supabase = await createClient();
  const isAdmin = await isViewerAdmin(supabase);
  const termStartDate = await getCurriculumTermStartDate(supabase);

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
    return {
      gradeName: '',
      lessonName: '',
      unitName: '',
      outcomes: [],
      contents: [],
      totalWeeks: 0,
      gradeSlug: null,
      lessonSlug: null,
      unitSlug: null,
      topicTitle: null,
      topicSlug: null,
      week: requestedWeek ?? getCurrentCurriculumWeek(38, termStartDate),
      termStartDate,
    };
  }

  console.log('[getDersData] sinifId:', sinifId, 'dersSlug:', dersSlug, 'gId:', gId, 'lId:', lId);

  // Sınıf ve ders bilgisini çek
  const [
    { data: grade, error: gradeError },
    { data: lesson, error: lessonError },
  ] = await Promise.all([
    supabase.from('grades').select('name, slug').eq('id', gId).single(),
    supabase.from('lessons').select('name, slug').eq('id', lId).single(),
  ]);

  if (gradeError) console.error('[getDersData] Grade sorgu hatasi:', gradeError);
  if (lessonError) console.error('[getDersData] Lesson sorgu hatasi:', lessonError);

  // Üniteleri çek (hafta sayısını ve aktif üniteyi belirlemek için)
  let unitsQuery = supabase
    .from('units')
    .select('id, title, slug, order_no, start_week, end_week')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .order('order_no', { ascending: true });
  if (!isAdmin) unitsQuery = unitsQuery.eq('is_active', true);
  const { data: unitsData } = await unitsQuery;

  const units = (unitsData as UnitRow[] | null) || [];

  const totalWeeks = (() => {
    // Önce ünitelerin end_week değerlerinden çıkar; yoksa 30.
    const maxFromUnits = units.reduce((max, u) => {
      const candidate = u.end_week ?? u.start_week ?? 0;
      return Math.max(max, candidate);
    }, 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  const week = requestedWeek ?? getCurrentCurriculumWeek(totalWeeks, termStartDate);

  const activeUnit =
    units.find((u) => {
      const sw = u.start_week ?? 1;
      const ew = u.end_week ?? totalWeeks;
      return week >= sw && week <= ew;
    }) ?? units[0] ?? null;

  const unitId = activeUnit?.id ?? null;
  const unitName = activeUnit?.title ?? '';
  const unitSlug = activeUnit?.slug ?? null;

  // Ünitedeki konuları çek (kazanım/icerik filtreleri için)
  let topicsQuery = unitId
    ? supabase
        .from('topics')
        .select('id, title, slug, order_no')
        .eq('unit_id', unitId)
        .order('order_no', { ascending: true })
    : null;
  if (topicsQuery && !isAdmin) topicsQuery = topicsQuery.eq('is_active', true);
  const { data: topicsData } = topicsQuery ? await topicsQuery : { data: null };

  const topics = (topicsData as TopicRow[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  const activeTopic = topics[0] ?? null;

  // Kazanımları çek
  const { data: weekOutcomes } = await supabase
    .from('outcome_weeks')
    .select('outcome_id, start_week, end_week')
    .lte('start_week', week)
    .gte('end_week', week);

  let outcomes: OutcomeVM[] = [];

  if (weekOutcomes?.length) {
    const outcomeIds = (weekOutcomes as WeekOutcomeRow[]).map((w) => w.outcome_id);

    const { data: outcomesData } = await supabase
      .from('outcomes')
      .select('id, description, topic_id, topics!inner(title, unit_id, units!inner(title, lesson_id, grade_id))')
      .in('id', outcomeIds);

    const typedOutcomes = (outcomesData as OutcomeRow[] | null) || [];
    const filteredOutcomesData = typedOutcomes
      .filter((o) => o.topics?.units?.lesson_id === lId && o.topics?.units?.grade_id === gId)
      .filter((o) => (topicIds.length ? topicIds.includes(o.topic_id ?? -1) : true));

    outcomes = filteredOutcomesData.map((o) => ({
      id: o.id,
      description: o.description,
      topicTitle: o.topics?.title || '',
    }));
  }

  let contents: ContentVM[] = [];

  if (!contents.length && topics.length) {
    contents = topics
      .slice()
      .sort((a, b) => a.order_no - b.order_no)
      .map((t) => ({
        id: t.id,
        title: t.title,
        content: null,
        orderNo: t.order_no,
        sections: [],
        heroImageUrl: null,
        subtitle: null,
        highlights: [],
      }));
  }

  if (topicIds.length) {
    const { data: topicContentsData } = await supabase
      .from('topic_contents')
      .select('id, topic_id, hero_image_url, subtitle')
      .in('topic_id', topicIds)
      .eq('is_published', true);

    const topicContentRows = (topicContentsData as TopicContentRow[] | null) || [];
    const topicIdByContentId = new Map(topicContentRows.map((tc) => [tc.id, tc.topic_id]));
    const contentIds = topicContentRows.map((tc) => tc.id);

    const heroByTopic = new Map<number, { heroImageUrl: string | null; subtitle: string | null }>();
    for (const tc of topicContentRows) {
      heroByTopic.set(tc.topic_id, { heroImageUrl: tc.hero_image_url, subtitle: tc.subtitle });
    }

    if (contentIds.length) {
      const [{ data: sectionsData }, { data: highlightsData }] = await Promise.all([
        supabase
          .from('topic_content_sections')
          .select('id, topic_content_id, order_no, heading, body_markdown, image_url, image_prompt, diagram_svg')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
        supabase
          .from('topic_content_highlights')
          .select('topic_content_id, icon, title, description, order_no')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
      ]);

      const sectionsByTopic = new Map<number, SectionVM[]>();
      for (const row of (sectionsData as SectionRow[] | null) || []) {
        const topicId = topicIdByContentId.get(row.topic_content_id);
        if (!topicId) continue;
        const list = sectionsByTopic.get(topicId) || [];
        list.push({
          id: row.id,
          heading: row.heading,
          html: row.body_markdown ? markdownToHtml(row.body_markdown) : null,
          imageUrl: row.image_url,
          imagePrompt: row.image_prompt,
          diagramSvg: row.diagram_svg,
        });
        sectionsByTopic.set(topicId, list);
      }

      const highlightsByTopic = new Map<number, HighlightVM[]>();
      for (const row of (highlightsData as HighlightRow[] | null) || []) {
        const topicId = topicIdByContentId.get(row.topic_content_id);
        if (!topicId) continue;
        const list = highlightsByTopic.get(topicId) || [];
        list.push({ icon: row.icon, title: row.title, description: row.description });
        highlightsByTopic.set(topicId, list);
      }

      contents = contents.map((c) => ({
        ...c,
        sections: sectionsByTopic.get(c.id) || [],
        heroImageUrl: heroByTopic.get(c.id)?.heroImageUrl || null,
        subtitle: heroByTopic.get(c.id)?.subtitle || null,
        highlights: highlightsByTopic.get(c.id) || [],
      }));
    }
  }

  return {
    gradeName: grade?.name || '',
    lessonName: lesson?.name || '',
    unitName,
    outcomes,
    contents,
    totalWeeks,
    gradeSlug: grade?.slug || null,
    lessonSlug: lesson?.slug || null,
    unitSlug,
    topicTitle: activeTopic?.title || null,
    topicSlug: activeTopic?.slug || null,
    week,
    termStartDate,
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
  const requestedHafta = Array.isArray(rawHafta)
    ? parseInt(rawHafta[0])
    : rawHafta
      ? parseInt(rawHafta)
      : null;

  console.log('[DersPage] sinif:', sinifId, 'ders:', dersSlug, 'unite:', uniteSlug, 'hafta:', requestedHafta);

  if (!sinifId || !dersSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Sınıf veya ders bilgisi eksik</p>
        <p className="text-xs text-gray-500 mt-2">sinif: {sinifId}, ders: {dersSlug}</p>
      </div>
    );
  }

  const data = await getDersData(sinifId, dersSlug, requestedHafta);

  if (!data.gradeName || !data.lessonName) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Sınıf veya ders bulunamadı</p>
          <p className="text-xs text-gray-500">Sınıf: {sinifId}, Ders: {dersSlug}</p>
        </div>
      </div>
    );
  }

  return <DersClient initialData={data} gradeId={sinifId} lessonId={dersSlug} week={data.week} />;
}
