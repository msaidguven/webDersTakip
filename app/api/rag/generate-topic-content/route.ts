import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateNextAiContentDraft } from '@/app/src/lib/aiContentDraftGen';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const result = await generateNextAiContentDraft(supabase);

  // net.http_post (pg_cron) bu yanıtı beklemiyor — sonucu admin panelinde görünür
  // kılmak için burada logluyoruz (ai_question_draft_worker_runs ile aynı desen).
  await supabase.from('ai_content_draft_worker_runs').insert({
    generated: result.generated,
    reason: result.reason ?? null,
    draft_id: result.draftId ?? null,
  });

  return NextResponse.json(result);
}
