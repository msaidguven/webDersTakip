import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { topicContentV11ToHtml } from '@/app/src/lib/topicContentV11';

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

  return NextResponse.json({ outcomes, contents });
}
