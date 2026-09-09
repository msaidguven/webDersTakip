import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { generateNextAiQuestionDraft } from '@/app/src/lib/aiQuestionDraftGen';

// RAG kuyruğu boşken (@kanka/@hocam sorusu yoksa) boşa giden 5 dakikalık döngülerin
// aksine, bu AYRI bir worker — saatte bir (kullanıcının 2026-09-08 isteği, 2026-09-09'da
// 3 saatten saate düşürüldü), kitabı yüklü ünitelerdeki sorusu eksik alt başlıklar için
// tek bir AI soru taslağı üretir. process-queue ile AYNI worker secret'ı kullanıyor —
// ikisi de Supabase pg_cron+pg_net'ten tetikleniyor (bkz.
// supabase/migrations/pg_cron_workers.sql; GitHub Actions'taki eski workflow'lar
// scheduled tetikleyicilerin güvenilmez çıkması üzerine 2026-09-09'da kaldırıldı).
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
