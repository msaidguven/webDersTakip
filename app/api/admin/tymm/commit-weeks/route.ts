import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { assignWeeksFromDocx, type DbTopic } from '@/app/src/lib/tymm/assignWeeksFromDocx';
import type { ParsedRow } from '@/app/src/lib/yillikPlan/docxParser';

// 2. ADIM'ın kaydı: eşleştirmeyi sunucu tarafında BİR DAHA çalıştırıp (istemciye
// güvenmemek için) sayılar hâlâ uyuyorsa outcome_weeks'i yazar. Var olan hafta
// kayıtları önce silinip yeniden eklenir (idempotent — aynı onayı iki kez vermek
// yinelenmiş satır oluşturmaz).
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

  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title, order_no')
    .eq('unit_id', unitId)
    .order('order_no', { ascending: true });
  const topics = (topicsData as { id: number; title: string; order_no: number }[] | null) || [];
  if (!topics.length) return NextResponse.json({ error: 'Bu ünitenin hiç konusu yok' }, { status: 400 });

  const topicIds = topics.map((t) => t.id);
  const { data: outcomesData } = await supabase
    .from('outcomes')
    .select('id, topic_id')
    .in('topic_id', topicIds)
    .order('id', { ascending: true });
  const outcomeRows = (outcomesData as { id: number; topic_id: number }[] | null) || [];

  const outcomeIdsByTopic = new Map<number, number[]>();
  for (const o of outcomeRows) {
    const list = outcomeIdsByTopic.get(o.topic_id) || [];
    list.push(o.id);
    outcomeIdsByTopic.set(o.topic_id, list);
  }

  const dbTopics: DbTopic[] = topics.map((t) => ({ topicId: t.id, topicTitle: t.title, outcomeIds: outcomeIdsByTopic.get(t.id) || [] }));
  const result = assignWeeksFromDocx(dbTopics, rows, uniteName);

  if (!result.ok) {
    return NextResponse.json({ error: 'Eşleşme artık uyuşmuyor — sayfayı yenileyip tekrar deneyin', result }, { status: 409 });
  }

  let weeksWritten = 0;
  for (const a of result.assignments) {
    await supabase.from('outcome_weeks').delete().eq('outcome_id', a.outcomeId);
    const { error } = await supabase
      .from('outcome_weeks')
      .insert({ outcome_id: a.outcomeId, start_week: a.startWeek, end_week: a.endWeek });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    weeksWritten += 1;
  }

  return NextResponse.json({ ok: true, weeksWritten });
}
