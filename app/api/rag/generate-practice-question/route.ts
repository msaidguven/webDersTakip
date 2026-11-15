import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { isQuestionWorkerId } from '@/app/src/lib/questionWorkerProfiles';
import { runQuestionWorker } from '@/app/src/lib/workerRuns';

// RAG kuyruğu boşken (@kanka/@hocam sorusu yoksa) boşa giden 5 dakikalık döngülerin
// aksine, bu AYRI bir worker — saatte bir (kullanıcının 2026-09-08 isteği, 2026-09-09'da
// 3 saatten saate düşürüldü), kitabı yüklü ünitelerdeki sorusu eksik alt başlıklar için
// tek bir AI soru taslağı üretir. process-queue ile AYNI worker secret'ı kullanıyor.
// Gövde workerRuns.ts'te: aynı iş GitHub Actions'tan da çalıştırılabiliyor (scripts/run-worker.ts).
//
// Gemini 503 (geçici aşırı yük) verirse geminiQuestionGen.ts bekleyip bir kez daha
// deniyor (kullanıcının 2026-09-19 isteği) — bu yüzden varsayılan süre bütçesi yetmez.
// 330 denendi ama bu projenin Vercel planında fonksiyon süresi tavanı 300sn — 330 deploy'u
// (build değil, Vercel'in fonksiyon doğrulama adımı) "Error" ile reddetti (canlıda
// görüldü). 300 bu projedeki DİĞER TÜM maxDuration'larla da (rag/documents,
// teacher-guide/documents) aynı, kanıtlanmış tavan.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  // Her tetikleyici body'de hangi worker olduğunu söyler; '{}' → primary (bkz. questionWorkerProfiles.ts).
  const body = (await request.json().catch(() => ({}))) as { worker?: unknown; task?: unknown };
  if (body.worker !== undefined && !isQuestionWorkerId(body.worker)) {
    return NextResponse.json({ error: 'Geçersiz worker' }, { status: 400 });
  }

  return NextResponse.json(await runQuestionWorker(createServiceClient(), body.worker, body.task));
}
