import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { isContentWorkerId, runContentWorker } from '@/app/src/lib/workerRuns';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  // Her tetikleyici body'de hangi worker olduğunu söyler; '{}' → primary. Gövde workerRuns.ts'te.
  const body = (await request.json().catch(() => ({}))) as { worker?: unknown };
  if (body.worker !== undefined && !isContentWorkerId(body.worker)) {
    return NextResponse.json({ error: 'Geçersiz worker' }, { status: 400 });
  }

  return NextResponse.json(await runContentWorker(createServiceClient(), body.worker));
}
