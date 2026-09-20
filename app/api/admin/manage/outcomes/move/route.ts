import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

// TYMM karşılaştırma ekranından tetikleniyor — bazı konuların öğrenme çıktısı (ve altındaki
// TÜM kazanımlar) yanlış konu satırına bağlanmış oluyor, admin bunu doğru konuya taşıyabilsin
// diye (kullanıcının 2026-09-20 isteği). Kazanım id'leri değişmediği için soru/soru bankası/
// içerik bağlantıları (question_outcomes, topic_content_section_outcomes) otomatik doğru
// kalır — sadece topic_id (ve konudaki tek öğrenme çıktısı metni) taşınır.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { sourceTopicId?: unknown; targetTopicId?: unknown } | null;
  const sourceTopicId = typeof body?.sourceTopicId === 'number' ? body.sourceTopicId : Number(body?.sourceTopicId);
  const targetTopicId = typeof body?.targetTopicId === 'number' ? body.targetTopicId : Number(body?.targetTopicId);

  if (!sourceTopicId || !targetTopicId || !Number.isInteger(sourceTopicId) || !Number.isInteger(targetTopicId) || sourceTopicId === targetTopicId) {
    return NextResponse.json({ error: 'Geçersiz konu seçimi' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const [{ data: sourceTopic }, { data: sourceOutcomes }, { data: targetMaxRow }] = await Promise.all([
    supabase.from('topics').select('id, learning_outcome').eq('id', sourceTopicId).maybeSingle(),
    supabase.from('outcomes').select('id').eq('topic_id', sourceTopicId).order('order_index', { ascending: true }),
    supabase.from('outcomes').select('order_index').eq('topic_id', targetTopicId).order('order_index', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!sourceTopic) return NextResponse.json({ error: 'Kaynak konu bulunamadı' }, { status: 404 });

  const outcomes = (sourceOutcomes as { id: number }[] | null) || [];
  let nextOrderIndex = ((targetMaxRow as { order_index: number | null } | null)?.order_index ?? 0) + 1;

  for (const o of outcomes) {
    const { error } = await supabase.from('outcomes').update({ topic_id: targetTopicId, order_index: nextOrderIndex }).eq('id', o.id);
    if (error) return NextResponse.json({ error: `Kazanım taşınamadı: ${error.message}` }, { status: 500 });
    nextOrderIndex += 1;
  }

  const learningOutcome = (sourceTopic as { learning_outcome: string | null }).learning_outcome;
  if (learningOutcome) {
    await supabase.from('topics').update({ learning_outcome: learningOutcome }).eq('id', targetTopicId);
    await supabase.from('topics').update({ learning_outcome: null }).eq('id', sourceTopicId);
  }

  return NextResponse.json({ ok: true, movedCount: outcomes.length });
}
