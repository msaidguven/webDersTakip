import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type TopicRow = { id: number; title: string; order_no: number; learning_outcome: string | null };
type OutcomeRow = { id: number; topic_id: number; description: string; code: string | null; learning_outcome_id: number | null; order_index: number | null };
type LearningOutcomeRow = { id: number; topic_id: number; code: string | null; title: string; order_no: number };

// Admin'in TYMM'den az önce içe aktardığı bir üniteyi, canlı TYMM sayfasıyla yan yana
// karşılaştırıp kontrol edebilmesi için DB'deki güncel konu/kazanım listesini döner.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const unitId = Number(request.nextUrl.searchParams.get('unitId'));
  if (!Number.isFinite(unitId)) return NextResponse.json({ error: 'unitId zorunlu' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: unitData } = await supabase
    .from('units')
    .select('id, title, duration_hours, key_concepts')
    .eq('id', unitId)
    .maybeSingle();
  if (!unitData) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title, order_no, learning_outcome')
    .eq('unit_id', unitId)
    .order('order_no', { ascending: true });
  const topics = (topicsData as TopicRow[] | null) || [];

  const topicIds = topics.map((t) => t.id);
  const [{ data: outcomesData }, { data: groupsData }] = topicIds.length
    ? await Promise.all([
        supabase.from('outcomes').select('id, topic_id, description, code, learning_outcome_id, order_index').in('topic_id', topicIds).eq('is_current', true).order('order_index', { ascending: true }).order('id', { ascending: true }),
        supabase.from('topic_learning_outcomes').select('id, topic_id, code, title, order_no').in('topic_id', topicIds).order('order_no', { ascending: true }),
      ])
    : [{ data: [] as OutcomeRow[] }, { data: [] as LearningOutcomeRow[] }];
  const outcomeRows = (outcomesData as OutcomeRow[] | null) || [];
  const groupRows = (groupsData as LearningOutcomeRow[] | null) || [];

  const outcomesByTopic = new Map<number, OutcomeRow[]>();
  for (const o of outcomeRows) {
    const list = outcomesByTopic.get(o.topic_id) || [];
    list.push(o);
    outcomesByTopic.set(o.topic_id, list);
  }
  const outcomesByGroup = new Map<number, OutcomeRow[]>();
  for (const o of outcomeRows) {
    if (o.learning_outcome_id == null) continue;
    const list = outcomesByGroup.get(o.learning_outcome_id) || [];
    list.push(o);
    outcomesByGroup.set(o.learning_outcome_id, list);
  }
  const groupsByTopic = new Map<number, LearningOutcomeRow[]>();
  for (const g of groupRows) {
    const list = groupsByTopic.get(g.topic_id) || [];
    list.push(g);
    groupsByTopic.set(g.topic_id, list);
  }

  return NextResponse.json({
    unit: unitData,
    topics: topics.map((t) => {
      const groups = groupsByTopic.get(t.id) || [];
      // Bu konunun kendi grubuna atanmamış (henüz yeni yapıya taşınmamış eski) kazanımları —
      // grup yoksa tamamı burada, gruplar varsa sadece hiçbirine düşmeyenler.
      const ungroupedOutcomes = (outcomesByTopic.get(t.id) || []).filter((o) => o.learning_outcome_id == null);
      return {
        id: t.id,
        title: t.title,
        learningOutcome: t.learning_outcome,
        outcomes: (outcomesByTopic.get(t.id) || []).map((o) => ({ id: o.id, code: o.code, description: o.description, orderIndex: o.order_index })),
        learningOutcomeGroups: groups.map((g) => ({
          id: g.id,
          code: g.code,
          title: g.title,
          outcomes: (outcomesByGroup.get(g.id) || []).map((o) => ({ id: o.id, code: o.code, description: o.description, orderIndex: o.order_index })),
        })),
        ungroupedOutcomes: ungroupedOutcomes.map((o) => ({ id: o.id, code: o.code, description: o.description, orderIndex: o.order_index })),
      };
    }),
  });
}
