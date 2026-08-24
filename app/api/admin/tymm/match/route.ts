import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { assignWeeksFromDocx, type DbTopic } from '@/app/src/lib/tymm/assignWeeksFromDocx';
import type { ParsedRow } from '@/app/src/lib/yillikPlan/docxParser';

type OutcomeRow = { id: number; topic_id: number; description: string; code: string | null };

// 2. ADIM'ın önizlemesi: daha önce TYMM'den içe aktarılmış (DB'de zaten var olan) bir
// ünitenin konu/kazanımlarını, verilen DOCX satırlarındaki hafta sırasıyla eşleştirmeyi
// DENER — hiçbir şey KAYDETMEZ. Sayılar uyuşmazsa admin burada görür, hiçbir yanlış
// hafta bilgisi yazılmadan.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { unitId?: unknown; uniteName?: unknown; rows?: unknown } | null;
  const unitId = Number(body?.unitId);
  const uniteName = typeof body?.uniteName === 'string' ? body.uniteName.trim() : '';
  const rows = Array.isArray(body?.rows) ? (body.rows as ParsedRow[]) : null;

  if (!Number.isFinite(unitId) || !uniteName || !rows) {
    return NextResponse.json({ error: 'unitId, uniteName ve rows zorunlu' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: unitData } = await supabase.from('units').select('id, title').eq('id', unitId).maybeSingle();
  if (!unitData) return NextResponse.json({ error: 'Ünite bulunamadı' }, { status: 404 });

  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title, order_no')
    .eq('unit_id', unitId)
    .order('order_no', { ascending: true });
  const topics = (topicsData as { id: number; title: string; order_no: number }[] | null) || [];
  if (!topics.length) {
    return NextResponse.json({ error: 'Bu ünitenin hiç konusu yok — önce 1. adımdan TYMM içeriğini aktarın' }, { status: 400 });
  }

  const topicIds = topics.map((t) => t.id);
  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, topic_id, description, code')
    .in('topic_id', topicIds)
    .order('id', { ascending: true }); // eklenme sırası = TYMM'deki a,b,c... sırası
  const outcomeRows = (outcomesData as OutcomeRow[] | null) || [];

  const outcomesByTopic = new Map<number, OutcomeRow[]>();
  for (const o of outcomeRows) {
    const list = outcomesByTopic.get(o.topic_id) || [];
    list.push(o);
    outcomesByTopic.set(o.topic_id, list);
  }

  const dbTopics: DbTopic[] = topics.map((t) => ({
    topicId: t.id,
    topicTitle: t.title,
    outcomeIds: (outcomesByTopic.get(t.id) || []).map((o) => o.id),
  }));

  const result = assignWeeksFromDocx(dbTopics, rows, uniteName);

  let preview: { topicId: number; topicTitle: string; outcomes: { id: number; code: string | null; description: string; startWeek: number; endWeek: number }[] }[] | null = null;
  if (result.ok) {
    const weekByOutcomeId = new Map(result.assignments.map((a) => [a.outcomeId, a]));
    preview = topics.map((t) => ({
      topicId: t.id,
      topicTitle: t.title,
      outcomes: (outcomesByTopic.get(t.id) || []).map((o) => {
        const w = weekByOutcomeId.get(o.id);
        return { id: o.id, code: o.code, description: o.description, startWeek: w?.startWeek ?? 0, endWeek: w?.endWeek ?? 0 };
      }),
    }));
  }

  return NextResponse.json({ unitTitle: (unitData as { title: string }).title, result, preview });
}
