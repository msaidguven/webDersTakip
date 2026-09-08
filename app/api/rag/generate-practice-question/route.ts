import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateNextAiQuestionDraft } from '@/app/src/lib/aiQuestionDraftGen';

// RAG kuyruğu boşken (@kanka/@hocam sorusu yoksa) boşa giden 5 dakikalık döngülerin
// aksine, bu AYRI bir worker — 3 saatte bir (bkz.
// .github/workflows/ai-question-draft-worker.yml), kitabı yüklü ünitelerdeki sorusu
// eksik alt başlıklar için tek bir AI soru taslağı üretir (kullanıcının 2026-09-08
// isteği). process-queue ile AYNI worker secret'ı kullanıyor — ikisi de aynı güven
// sınırındaki (GitHub Actions) iç bir tetikleyici.
export async function POST(request: NextRequest) {
  const secret = process.env.RAG_QUEUE_WORKER_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const result = await generateNextAiQuestionDraft(supabase);
  return NextResponse.json(result);
}
