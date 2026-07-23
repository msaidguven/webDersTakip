import { createClient } from '@/utils/supabase/server';
import DersClient from '../../ders/DersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Params {
  gradeSlug: string;
  lessonSlug: string;
}

interface PageProps {
  params: Promise<Params>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toHtmlFromV11Payload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  const direct =
    (typeof p.content === 'string' && p.content) ||
    (typeof p.html === 'string' && p.html) ||
    (typeof p.content_html === 'string' && p.content_html);
  if (direct) return direct;

  const sections = p.sections;
  if (Array.isArray(sections)) {
    const html = sections
      .map((s) => {
        if (!s || typeof s !== 'object') return '';
        const so = s as Record<string, unknown>;
        const title = typeof so.title === 'string' ? so.title : null;
        const body =
          (typeof so.content === 'string' && so.content) ||
          (typeof so.html === 'string' && so.html) ||
          (typeof so.text === 'string' && so.text) ||
          '';
        if (!title && !body) return '';
        if (title && body) return `<h3>${title}</h3>\n${body}`;
        return body || (title ? `<h3>${title}</h3>` : '');
      })
      .filter(Boolean)
      .join('\n\n');
    return html || null;
  }

  return `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`;
}

async function getDersDataBySlugs(gradeSlug: string, lessonSlug: string, week: number) {
  const supabase = await createClient();

  const { data: grade } = await supabase.from('grades').select('id, name, slug').eq('slug', gradeSlug).single();
  const { data: lesson } = await supabase.from('lessons').select('id, name, slug').eq('slug', lessonSlug).single();

  if (!grade || !lesson) {
    return null;
  }

  const gId = grade.id;
  const lId = lesson.id;

  const { data: unitsData } = await supabase
    .from('units')
    .select('id, title, slug, order_no, start_week, end_week')
    .eq('lesson_id', lId)
    .eq('grade_id', gId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const units = (unitsData as any[]) || [];

  const totalWeeks = (() => {
    const maxFromUnits = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0);
    return Math.max(1, Math.min(52, maxFromUnits || 30));
  })();

  const activeUnit = units.find((u) => {
    const sw = u.start_week ?? 1;
    const ew = u.end_week ?? totalWeeks;
    return week >= sw && week <= ew;
  }) ?? units[0] ?? null;

  const unitId = activeUnit?.id ?? null;
  const unitName = activeUnit?.title ?? '';
  const unitSlug = activeUnit?.slug ?? null;

  const { data: topicsData } = unitId
    ? await supabase
        .from('topics')
        .select('id, title, slug, order_no')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('order_no', { ascending: true })
    : { data: null };

  const topics = (topicsData as any[]) || [];
  const topicIds = topics.map((t) => t.id);
  const activeTopic = topics[0] ?? null;

  const { data: weekOutcomes } = await supabase
    .from('outcome_weeks')
    .select('outcome_id, start_week, end_week')
    .lte('start_week', week)
    .gte('end_week', week);

  let outcomes: any[] = [];
  let outcomeIds: number[] = [];
  
  if (weekOutcomes?.length) {
    outcomeIds = (weekOutcomes as any[]).map((w) => w.outcome_id);
    
    const { data: outcomesData } = await supabase
      .from('outcomes')
      .select('id, description, topic_id, topics!inner(title, unit_id, units!inner(title, lesson_id, grade_id))')
      .in('id', outcomeIds);

    const typedOutcomes = (outcomesData as any[]) || [];
    const filteredOutcomesData = typedOutcomes
      .filter((o) => o.topics?.units?.lesson_id === lId && o.topics?.units?.grade_id === gId)
      .filter((o) => (topicIds.length ? topicIds.includes(o.topic_id ?? -1) : true));

    outcomes = filteredOutcomesData.map((o) => ({
      id: o.id,
      description: o.description,
      topicTitle: o.topics?.title || '',
    }));

    outcomeIds = filteredOutcomesData.map((o) => o.id);
  }

  let contents: any[] = [];
  if (outcomeIds.length) {
    const { data: relData } = await supabase
      .from('topic_content_outcomes_v11')
      .select('topic_content_v11_id, outcome_id')
      .in('outcome_id', outcomeIds);

    const rels = (relData as any[]) || [];
    const contentV11Ids = Array.from(new Set(rels.map((r) => r.topic_content_v11_id))).filter((x) => !!x);

    if (contentV11Ids.length) {
      const { data: v11Data } = await supabase
        .from('topic_contents_v11')
        .select('id, topic_id, title, payload, version_no')
        .in('id', contentV11Ids)
        .eq('is_published', true);

      const v11Rows = (v11Data as any[]) || [];
      const bestByTopic = new Map<number, any>();
      for (const row of v11Rows) {
        const prev = bestByTopic.get(row.topic_id);
        if (!prev || (row.version_no ?? 0) > (prev.version_no ?? 0)) {
          bestByTopic.set(row.topic_id, row);
        }
      }

      const sortedTopics = topics.slice().sort((a, b) => a.order_no - b.order_no);
      contents = sortedTopics
        .map((t) => {
          const v11 = bestByTopic.get(t.id);
          if (!v11) return null;
          const html = toHtmlFromV11Payload(v11.payload) || '';
          return {
            id: v11.id,
            title: v11.title || t.title,
            content: html,
            orderNo: t.order_no,
          };
        })
        .filter((x) => x !== null);
    }
  }

  return {
    gradeId: gId.toString(),
    lessonId: lId.toString(),
    gradeName: grade.name,
    lessonName: lesson.name,
    unitName,
    outcomes,
    contents,
    totalWeeks,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug,
    topicTitle: activeTopic?.title || null,
    topicSlug: activeTopic?.slug || null,
  };
}

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { gradeSlug, lessonSlug } = await params;
  const sp = await searchParams;
  
  const rawHafta = sp.hafta;
  const hafta = Array.isArray(rawHafta) ? parseInt(rawHafta[0]) : (rawHafta ? parseInt(rawHafta) : 19);

  const data = await getDersDataBySlugs(gradeSlug, lessonSlug, hafta);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Ders bulunamadı.</p>
      </div>
    );
  }

  return (
    <DersClient 
      initialData={data} 
      gradeId={data.gradeId} 
      lessonId={data.lessonId} 
      week={hafta} 
    />
  );
}
