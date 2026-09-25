import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateNextAiContentDraft } from '@/app/src/lib/aiContentDraftGen';
import { CONTENT_WORKER_PROFILES, type ContentWorkerId } from '@/app/src/lib/contentWorkerProfiles';

export const maxDuration = 300;

function isContentWorkerId(value: unknown): value is ContentWorkerId {
  return typeof value === 'string' && Object.hasOwn(CONTENT_WORKER_PROFILES, value);
}

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  // Her pg_cron job'u body'de hangi worker olduğunu söyler; eski job '{}' gönderiyor → primary.
  const body = (await request.json().catch(() => ({}))) as { worker?: unknown };
  if (body.worker !== undefined && !isContentWorkerId(body.worker)) {
    return NextResponse.json({ error: 'Geçersiz worker' }, { status: 400 });
  }
  const profile = CONTENT_WORKER_PROFILES[body.worker ?? 'primary'];

  const supabase = createServiceClient();
  const result = await generateNextAiContentDraft(supabase, profile);

  // net.http_post (pg_cron) bu yanıtı beklemiyor — sonucu admin panelinde görünür
  // kılmak için burada logluyoruz (ai_question_draft_worker_runs ile aynı desen).
  await supabase.from('ai_content_draft_worker_runs').insert({
    generated: result.generated,
    reason: result.reason ?? null,
    draft_id: result.draftId ?? null,
    worker: profile.id,
  });

  return NextResponse.json(result);
}
