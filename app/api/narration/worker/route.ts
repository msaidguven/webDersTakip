import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { runNarrationWorker } from '@/app/src/lib/workerRuns';

// "Video / Sesli Anlatım" worker'ı (bkz. supabase/migrations/topic_narrations.sql). Gövde workerRuns.ts'te:
// aynı iş GitHub Actions'tan da çalıştırılabiliyor (scripts/run-worker.ts). Çağrının çoğu TTS yanıtı
// beklemek (aktif CPU'ya sayılmaz), MP3 Azure'dan hazır geldiği için kodlama yok.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const { status, body } = await runNarrationWorker(createServiceClient());
  return NextResponse.json(body, { status });
}
