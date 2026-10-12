import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { publishTopicBatch } from '@/app/src/lib/topicQuestionBatch';

// İnceleme bekleyen (Türkçe) konu partisini yayınlar — Claude taslakları okuyup düzelttikten sonra
// admin /admin/soru-bildirimleri'nde "Yayınla"ya basar (bkz. ai_topic_question_batch_review_hold.sql).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { topicId?: unknown; roundNo?: unknown } | null;
  const topicId = Number(body?.topicId);
  const roundNo = Number(body?.roundNo);
  if (!Number.isInteger(topicId) || !Number.isInteger(roundNo)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  // Yalnız 'awaiting_review' → 'publishing' (çift tıklamada ikinci istek boşa düşsün).
  const { data: claimed, error } = await supabase
    .from('ai_topic_question_batches')
    .update({ status: 'publishing', claimed_at: new Date().toISOString() })
    .eq('topic_id', topicId)
    .eq('round_no', roundNo)
    .eq('status', 'awaiting_review')
    .select('topic_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claimed?.length) return NextResponse.json({ error: 'Bu parti inceleme beklemiyor' }, { status: 409 });

  const result = await publishTopicBatch(supabase, topicId, roundNo, { force: true });
  return NextResponse.json(result, { status: result.generated ? 200 : 500 });
}
