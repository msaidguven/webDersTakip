import type { SupabaseClient } from '@supabase/supabase-js';
import { markdownToHtml } from '@/app/src/lib/topicContentV11';

type WeekOutcomeRow = { outcome_id: number };
type OutcomeRow = {
  id: number;
  description: string;
  topic_id: number;
  order_index: number | null;
};
type TopicRow = { id: number; title: string; slug: string | null; order_no: number };
type TopicContentRow = { id: number; topic_id: number; hero_image_url: string | null; subtitle: string | null; generation_meta: unknown };
type SectionRow = {
  id: number;
  topic_content_id: number;
  order_no: number;
  heading: string;
  body_markdown: string | null;
  image_url: string | null;
  image_prompt: string | null;
  image_alt: string | null;
  diagram_svg: string | null;
};
type HighlightRow = {
  topic_content_id: number;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};

export type LessonWeekOutcome = { id: number; description: string; topicId: number | null; topicTitle: string };
export type LessonWeekSection = { id: number; heading: string; html: string | null; imageUrl: string | null; imagePrompt: string | null; imageAlt: string | null; diagramSvg: string | null };
export type LessonWeekContent = {
  id: number;
  title: string;
  slug: string | null;
  content: string | null;
  orderNo: number;
  sections: LessonWeekSection[];
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  subtitle: string | null;
  highlights: { icon: string | null; title: string; description: string }[];
};

function extractHeroImageAlt(generationMeta: unknown): string | null {
  if (!generationMeta || typeof generationMeta !== 'object') return null;
  const val = (generationMeta as Record<string, unknown>).heroImageAlt;
  return typeof val === 'string' && val.trim() ? val : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLessonWeekData(supabase: SupabaseClient<any, any, any>, unitId: number, week: number) {
  const [
    { data: topicsData },
    { data: weekOutcomes },
  ] = await Promise.all([
    supabase
      .from('topics')
      .select('id, title, slug, order_no')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .order('order_no', { ascending: true }),
    supabase
      .from('outcome_weeks')
      .select('outcome_id')
      .lte('start_week', week)
      .gte('end_week', week),
  ]);

  const topics = (topicsData as TopicRow[] | null) || [];
  const topicIds = topics.map((t) => t.id);
  const topicTitleById = new Map(topics.map((topic) => [topic.id, topic.title]));
  let outcomes: LessonWeekOutcome[] = [];

  if (topicIds.length) {
    const { data: outcomesData } = await supabase
      .from('outcomes')
      .select('id, description, topic_id, order_index')
      .in('topic_id', topicIds)
      .order('order_index', { ascending: true });

    const allTopicOutcomes = (outcomesData as OutcomeRow[] | null) || [];
    const weekOutcomeIds = new Set(((weekOutcomes as WeekOutcomeRow[] | null) || []).map((w) => w.outcome_id));
    const weekMatchedOutcomes = allTopicOutcomes.filter((outcome) => weekOutcomeIds.has(outcome.id));
    const filtered = weekMatchedOutcomes.length ? weekMatchedOutcomes : allTopicOutcomes;

    outcomes = filtered.map((o) => ({
      id: o.id,
      description: o.description,
      topicId: o.topic_id,
      topicTitle: topicTitleById.get(o.topic_id) || '',
    }));
  }

  let contents: LessonWeekContent[] = topics.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
    content: null,
    orderNo: t.order_no,
    sections: [],
    heroImageUrl: null,
    heroImageAlt: null,
    subtitle: null,
    highlights: [],
  }));

  if (topicIds.length) {
    const { data: topicContentsData } = await supabase
      .from('topic_contents')
      .select('id, topic_id, hero_image_url, subtitle, generation_meta')
      .in('topic_id', topicIds)
      .eq('is_published', true);

    const topicContentRows = (topicContentsData as TopicContentRow[] | null) || [];
    const topicIdByContentId = new Map(topicContentRows.map((tc) => [tc.id, tc.topic_id]));
    const contentIds = topicContentRows.map((tc) => tc.id);

    const heroByTopic = new Map<number, { heroImageUrl: string | null; heroImageAlt: string | null; subtitle: string | null }>();
    for (const tc of topicContentRows) {
      heroByTopic.set(tc.topic_id, {
        heroImageUrl: tc.hero_image_url,
        heroImageAlt: extractHeroImageAlt(tc.generation_meta),
        subtitle: tc.subtitle,
      });
    }

    const sectionsByTopic = new Map<number, LessonWeekSection[]>();
    const highlightsByTopic = new Map<number, { icon: string | null; title: string; description: string }[]>();

    if (contentIds.length) {
      const [{ data: sectionsData, error: sectionsError }, { data: highlightsData }] = await Promise.all([
        supabase
          .from('topic_content_sections')
          .select('id, topic_content_id, order_no, heading, body_markdown, image_url, image_prompt, image_alt, diagram_svg')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
        supabase
          .from('topic_content_highlights')
          .select('topic_content_id, icon, title, description, order_no')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
      ]);

      // Sorgu bir sebeple (ör. eksik migration) hata verirse sessizce boş alt başlık
      // listesine düşmek yerine logluyoruz — aksi halde TÜM konularda alt başlık/içerik
      // aynı anda kaybolur ve neden anlaşılmaz.
      if (sectionsError) {
        console.error('[getLessonWeekData] topic_content_sections sorgusu başarısız:', sectionsError.message);
      }

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
          imageAlt: row.image_alt,
          diagramSvg: row.diagram_svg,
        });
        sectionsByTopic.set(topicId, list);
      }

      for (const row of (highlightsData as HighlightRow[] | null) || []) {
        const topicId = topicIdByContentId.get(row.topic_content_id);
        if (!topicId) continue;
        const list = highlightsByTopic.get(topicId) || [];
        list.push({ icon: row.icon, title: row.title, description: row.description });
        highlightsByTopic.set(topicId, list);
      }
    }

    contents = contents.map((c) => ({
      ...c,
      sections: sectionsByTopic.get(c.id) || [],
      heroImageUrl: heroByTopic.get(c.id)?.heroImageUrl || null,
      heroImageAlt: heroByTopic.get(c.id)?.heroImageAlt || null,
      subtitle: heroByTopic.get(c.id)?.subtitle || null,
      highlights: highlightsByTopic.get(c.id) || [],
    }));
  }

  return { outcomes, contents };
}
