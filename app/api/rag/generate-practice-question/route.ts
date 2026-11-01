import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { runTopicBatchStep } from '@/app/src/lib/topicQuestionBatch';
import { QUESTION_WORKER_PROFILES, isQuestionWorkerId } from '@/app/src/lib/questionWorkerProfiles';
import { runYaziliStep } from '@/app/src/lib/yazili/worker';
import { runInteractiveLessonStep, runInteractiveVoiceStep } from '@/app/src/lib/interactiveLesson/worker';
import { QUOTA_TAG_RE } from '@/app/src/lib/geminiJsonGen';

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
  // task: 'interactive_lesson' → yalnız etkileşimli ders işi (iş yoksa soru partisine GEÇMEZ). :33/:53 ek
  // çalışmaları bunu gönderir; ders işi bitince bu anahtarla saatte yine tek soru partisi yapılsın diye
  // (bkz. supabase/migrations/interactive_lesson_worker_cron.sql).
  const body = (await request.json().catch(() => ({}))) as { worker?: unknown; task?: unknown };
  if (body.worker !== undefined && !isQuestionWorkerId(body.worker)) {
    return NextResponse.json({ error: 'Geçersiz worker' }, { status: 400 });
  }
  const profile = QUESTION_WORKER_PROFILES[body.worker ?? 'primary'];

  const supabase = createServiceClient();

  // Kota kısa devresi (2026-11-01): bu worker'ın son çalışması "günlük kota doldu" dediyse, kota açılana kadar
  // hiçbir şey denenmez (Gemini'ye istek, konu/taslak seçimi yok) — boşuna CPU ve log harcanmasın. Yalnız
  // Gemini'siz iş (etkileşimli dersin Bit sesleri) yapılır. Kayıt zinciri sürsün diye atlanan çalışma da aynı
  // etiketle loglanır.
  const { data: last } = await supabase.from('ai_question_draft_worker_runs').select('reason').eq('worker', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const quotaUntil = QUOTA_TAG_RE.exec((last as { reason: string | null } | null)?.reason ?? '')?.[1];
  if (quotaUntil && Date.parse(quotaUntil) > Date.now()) {
    const voice = profile.interactiveLesson ? await runInteractiveVoiceStep(supabase) : null;
    const hhmm = new Date(quotaUntil).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
    const skipped = { generated: voice?.generated ?? false, reason: `${voice ? `${voice.reason} · ` : ''}Gemini günlük kotası dolu, ${hhmm}'e kadar atlandı [kota:${quotaUntil}]` };
    await supabase.from('ai_question_draft_worker_runs').insert({ generated: skipped.generated, reason: skipped.reason, draft_id: null, worker: profile.id });
    return NextResponse.json(skipped);
  }

  // 2026-10-12: alt başlık başına admin onaylı taslak yerine konu bazlı otomatik parti
  // (bkz. topicQuestionBatch.ts). Eski akış generateNextAiQuestionDraft olarak duruyor.
  // Yazılıya ayrılan worker önce v1 yazılı sorusu eksik konuya bakar; etkileşimli derse ayrılan worker önce
  // ders/ses işine (2026-11-01); iş yoksa ikisi de test partisine geçer.
  const result =
    body.task === 'interactive_lesson'
      ? ((await runInteractiveLessonStep(supabase, profile)) ?? { generated: false, reason: 'Etkileşimli ders: sırada iş yok' })
      : ((profile.yazili ? await runYaziliStep(supabase, profile) : null) ??
        (profile.interactiveLesson ? await runInteractiveLessonStep(supabase, profile) : null) ??
        (await runTopicBatchStep(supabase, profile)));

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
