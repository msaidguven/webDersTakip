import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { runTopicBatchStep } from '@/app/src/lib/topicQuestionBatch';
import { QUESTION_WORKER_PROFILES, isQuestionWorkerId } from '@/app/src/lib/questionWorkerProfiles';

// RAG kuyruğu boşken (@kanka/@hocam sorusu yoksa) boşa giden 5 dakikalık döngülerin
// aksine, bu AYRI bir worker — saatte bir (kullanıcının 2026-09-08 isteği, 2026-09-09'da
// 3 saatten saate düşürüldü), kitabı yüklü ünitelerdeki sorusu eksik alt başlıklar için
// tek bir AI soru taslağı üretir. process-queue ile AYNI worker secret'ı kullanıyor —
// ikisi de Supabase pg_cron+pg_net'ten tetikleniyor (bkz.
// supabase/migrations/pg_cron_workers.sql; GitHub Actions'taki eski workflow'lar
// scheduled tetikleyicilerin güvenilmez çıkması üzerine 2026-09-09'da kaldırıldı).
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

  // Her pg_cron job'u body'de hangi worker olduğunu söyler; eski job '{}' gönderiyor → primary
  // (bkz. questionWorkerProfiles.ts).
  const body = (await request.json().catch(() => ({}))) as { worker?: unknown };
  if (body.worker !== undefined && !isQuestionWorkerId(body.worker)) {
    return NextResponse.json({ error: 'Geçersiz worker' }, { status: 400 });
  }
  const profile = QUESTION_WORKER_PROFILES[body.worker ?? 'primary'];

  const supabase = createServiceClient();
  // 2026-10-12: alt başlık başına admin onaylı taslak yerine konu bazlı otomatik parti
  // (bkz. topicQuestionBatch.ts). Eski akış generateNextAiQuestionDraft olarak duruyor.
  const result = await runTopicBatchStep(supabase, profile);

  // net.http_post (pg_cron) bu yanıtı beklemiyor — sonucu admin panelinde görünür
  // kılmak için burada logluyoruz (bkz. supabase/migrations/ai_question_draft_worker_runs.sql).
  const { error: logError } = await supabase.from('ai_question_draft_worker_runs').insert({
    generated: result.generated,
    reason: result.reason ?? null,
    draft_id: result.draftId ?? null,
    worker: profile.id,
  });
  if (logError) console.error('ai_question_draft_worker_runs log yazılamadı:', logError.message);

  return NextResponse.json(result);
}
