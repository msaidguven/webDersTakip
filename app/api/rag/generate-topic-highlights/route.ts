import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateNextTopicHighlights } from '@/app/src/lib/aiTopicHighlightsGen';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const result = await generateNextTopicHighlights(supabase);

  // net.http_post (pg_cron) bu yanıtı beklemiyor — sonucu görünür kılmak için logluyoruz
  // (ai_content_draft_worker_runs ile aynı desen).
  await supabase.from('ai_topic_highlights_worker_runs').insert({
    generated: result.generated,
    reason: result.reason ?? null,
    topic_id: result.topicId ?? null,
  });

  return NextResponse.json(result);
}
