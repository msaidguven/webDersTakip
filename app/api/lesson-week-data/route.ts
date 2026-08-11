import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { topicContentV11ToHtml, markdownToHtml } from '@/app/src/lib/topicContentV11';

type WeekOutcomeRow = { outcome_id: number };
type OutcomeRow = {
  id: number;
  description: string;
  topic_id: number;
  order_index: number | null;
};
type TopicRow = { id: number; title: string; order_no: number };
type TopicContentOutcomeV11Row = { topic_content_v11_id: number };
type TopicContentV11Row = {
  id: number;
  topic_id: number;
  payload: unknown;
  version_no: number;
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
};
type HighlightRow = {
  topic_content_id: number;
  position: string;
  icon: string | null;
  title: string;
  description: string;
  order_no: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeId = Number(searchParams.get('gradeId'));
  const lessonId = Number(searchParams.get('lessonId'));
  const unitId = Number(searchParams.get('unitId'));
  const week = Number(searchParams.get('week'));

  if (![gradeId, lessonId, unitId, week].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Eksik veya hatalı parametre' }, { status: 400 });
  }

  const supabase = await createClient();

  const [
    { data: topicsData },
    { data: weekOutcomes },
  ] = await Promise.all([
    supabase
      .from('topics')
      .select('id, title, order_no')
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
  let outcomes: { id: number; description: string; topicId: number | null; topicTitle: string }[] = [];
  let outcomeIds: number[] = [];

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
    outcomeIds = filtered.map((o) => o.id);
  }

  let contents = topics.map((t) => ({
    id: t.id,
    title: t.title,
    content: null as string | null,
    orderNo: t.order_no,
  }));

  if (outcomeIds.length) {
    const { data: relData } = await supabase
      .from('topic_content_outcomes_v11')
      .select('topic_content_v11_id')
      .in('outcome_id', outcomeIds);

    const contentV11Ids = Array.from(
      new Set(((relData as TopicContentOutcomeV11Row[] | null) || []).map((r) => r.topic_content_v11_id))
    ).filter((id): id is number => Boolean(id));

    if (contentV11Ids.length) {
      const { data: v11Data } = await supabase
        .from('topic_contents_v11')
        .select('id, topic_id, payload, version_no')
        .in('id', contentV11Ids)
        .eq('is_published', true);

      const bestByTopic = new Map<number, TopicContentV11Row>();
      for (const row of (v11Data as TopicContentV11Row[] | null) || []) {
        const prev = bestByTopic.get(row.topic_id);
        if (!prev || (row.version_no ?? 0) > (prev.version_no ?? 0)) {
          bestByTopic.set(row.topic_id, row);
        }
      }

      contents = topics.map((t) => {
        const v11 = bestByTopic.get(t.id);
        return {
          id: t.id,
          title: t.title,
          content: v11 ? topicContentV11ToHtml(v11.payload) : null,
          orderNo: t.order_no,
        };
      });
    }
  }

  const sectionsByTopic = new Map<number, { id: number; heading: string; html: string | null; imageUrl: string | null; imagePrompt: string | null }[]>();
  const heroByTopic = new Map<number, { heroImageUrl: string | null; subtitle: string | null }>();
  const highlightsByTopic = new Map<number, { position: string; icon: string | null; title: string; description: string }[]>();

  if (topicIds.length) {
    const { data: topicContentsData } = await supabase
      .from('topic_contents')
      .select('id, topic_id, hero_image_url, subtitle')
      .in('topic_id', topicIds);

    const topicContentRows = (topicContentsData as TopicContentRow[] | null) || [];
    const topicIdByContentId = new Map(topicContentRows.map((tc) => [tc.id, tc.topic_id]));
    const contentIds = topicContentRows.map((tc) => tc.id);

    for (const tc of topicContentRows) {
      heroByTopic.set(tc.topic_id, { heroImageUrl: tc.hero_image_url, subtitle: tc.subtitle });
    }

    if (contentIds.length) {
      const [{ data: sectionsData }, { data: highlightsData }] = await Promise.all([
        supabase
          .from('topic_content_sections')
          .select('id, topic_content_id, order_no, heading, body_markdown, image_url, image_prompt')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
        supabase
          .from('topic_content_highlights')
          .select('topic_content_id, position, icon, title, description, order_no')
          .in('topic_content_id', contentIds)
          .order('order_no', { ascending: true }),
      ]);

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
        });
        sectionsByTopic.set(topicId, list);
      }

      for (const row of (highlightsData as HighlightRow[] | null) || []) {
        const topicId = topicIdByContentId.get(row.topic_content_id);
        if (!topicId) continue;
        const list = highlightsByTopic.get(topicId) || [];
        list.push({ position: row.position, icon: row.icon, title: row.title, description: row.description });
        highlightsByTopic.set(topicId, list);
      }
    }
  }

  const contentsWithSections = contents.map((c) => ({
    ...c,
    sections: sectionsByTopic.get(c.id) || [],
    heroImageUrl: heroByTopic.get(c.id)?.heroImageUrl || null,
    subtitle: heroByTopic.get(c.id)?.subtitle || null,
    highlights: highlightsByTopic.get(c.id) || [],
  }));

  return NextResponse.json({ outcomes, contents: contentsWithSections });
}
