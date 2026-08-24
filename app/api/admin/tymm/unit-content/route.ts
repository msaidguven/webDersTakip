import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

type TopicRow = { id: number; title: string; order_no: number; learning_outcome: string | null };
type OutcomeRow = { id: number; topic_id: number; description: string; code: string | null };

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
  const { data: outcomesData } = topicIds.length
    ? await supabase.from('outcomes').select('id, topic_id, description, code').in('topic_id', topicIds).order('id', { ascending: true })
    : { data: [] as OutcomeRow[] };
  const outcomeRows = (outcomesData as OutcomeRow[] | null) || [];

  const outcomesByTopic = new Map<number, OutcomeRow[]>();
  for (const o of outcomeRows) {
    const list = outcomesByTopic.get(o.topic_id) || [];
    list.push(o);
    outcomesByTopic.set(o.topic_id, list);
  }

  return NextResponse.json({
    unit: unitData,
    topics: topics.map((t) => ({
      id: t.id,
      title: t.title,
      learningOutcome: t.learning_outcome,
      outcomes: (outcomesByTopic.get(t.id) || []).map((o) => ({ id: o.id, code: o.code, description: o.description })),
    })),
  });
}
