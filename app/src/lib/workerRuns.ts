// app/src/lib/workerRuns.ts
// Zamanlanmış worker'ların gövdesi — tek tanım, iki çağıran:
//  - Vercel rotaları (/api/rag/generate-practice-question, /api/rag/generate-topic-content, /api/narration/worker)
//  - scripts/run-worker.ts (GitHub Actions; 2026-11-15: worker'lar Vercel'in aktif CPU sınırını yemesin diye)
// Her çalışma sonucunu kendi *_worker_runs tablosuna yazar (admin panelindeki "Son Çalışmalar").
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runTopicBatchStep } from '@/app/src/lib/topicQuestionBatch';
import { QUESTION_WORKER_PROFILES, type QuestionWorkerId } from '@/app/src/lib/questionWorkerProfiles';
import { runYaziliStep } from '@/app/src/lib/yazili/worker';
import { runInteractiveLessonStep, runInteractiveVoiceStep } from '@/app/src/lib/interactiveLesson/worker';
import { QUOTA_TAG_RE } from '@/app/src/lib/geminiJsonGen';
import { generateNextAiContentDraft } from '@/app/src/lib/aiContentDraftGen';
import { generateNextRecapCards } from '@/app/src/lib/recapCardsGen';
import { CONTENT_WORKER_PROFILES, type ContentWorkerId } from '@/app/src/lib/contentWorkerProfiles';
import { createAzureEngine } from '@/app/src/lib/narration/azureTts';
import { generateTopicNarration } from '@/app/src/lib/narration/generateTopicNarration';
import { revalidateTopicPage } from '@/app/src/lib/topicPageRevalidation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

export function isContentWorkerId(value: unknown): value is ContentWorkerId {
  return typeof value === 'string' && Object.hasOwn(CONTENT_WORKER_PROFILES, value);
}

// task: 'interactive_lesson' → yalnız etkileşimli ders işi (iş yoksa soru partisine GEÇMEZ). :33/:53 ek
// çalışmaları bunu gönderir; ders işi bitince bu anahtarla saatte yine tek soru partisi yapılsın diye
// (bkz. supabase/migrations/interactive_lesson_worker_cron.sql).
export async function runQuestionWorker(supabase: Supabase, workerId: QuestionWorkerId = 'primary', task?: unknown) {
  const profile = QUESTION_WORKER_PROFILES[workerId];

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
    return skipped;
  }

  // 2026-10-12: alt başlık başına admin onaylı taslak yerine konu bazlı otomatik parti
  // (bkz. topicQuestionBatch.ts). Eski akış generateNextAiQuestionDraft olarak duruyor.
  // Yazılıya ayrılan worker önce v1 yazılı sorusu eksik konuya bakar; etkileşimli derse ayrılan worker önce
  // ders/ses işine (2026-11-01); iş yoksa ikisi de test partisine geçer.
  const result =
    task === 'interactive_lesson'
      ? ((await runInteractiveLessonStep(supabase, profile)) ?? { generated: false, reason: 'Etkileşimli ders: sırada iş yok' })
      : ((profile.yazili ? await runYaziliStep(supabase, profile) : null) ??
        (profile.interactiveLesson ? await runInteractiveLessonStep(supabase, profile) : null) ??
        (await runTopicBatchStep(supabase, profile)));

  // Tetikleyen (pg_cron) yanıtı beklemiyor — sonucu admin panelinde görünür kılmak için burada
  // logluyoruz (bkz. supabase/migrations/ai_question_draft_worker_runs.sql).
  const { error: logError } = await supabase.from('ai_question_draft_worker_runs').insert({
    generated: result.generated,
    reason: result.reason ?? null,
    draft_id: result.draftId ?? null,
    worker: profile.id,
  });
  if (logError) console.error('ai_question_draft_worker_runs log yazılamadı:', logError.message);

  return result;
}

export async function runContentWorker(supabase: Supabase, workerId: ContentWorkerId = 'primary') {
  const profile = CONTENT_WORKER_PROFILES[workerId];
  const result = await generateNextAiContentDraft(supabase, profile);

  // Tetikleyen yanıtı beklemiyor — sonuç burada loglanır (ai_question_draft_worker_runs ile aynı desen).
  const { error: logError } = await supabase.from('ai_content_draft_worker_runs').insert({
    generated: result.generated,
    reason: result.reason ?? null,
    draft_id: result.draftId ?? null,
    worker: profile.id,
  });
  if (logError) console.error('ai_content_draft_worker_runs log yazılamadı:', logError.message);

  // Yeni konu yoksa bu saat kartı eksik bir konuya hap bilgi kartı üretir (2026-10-24, saatte 1 konu; yeni
  // konularda kart içerikle aynı çağrıda geliyor). Ayrı kayıt: kind='recap_card', topic_id başarısızlık sayımı için.
  if (result.idle) {
    const recap = await generateNextRecapCards(supabase, profile);
    // Kota/aşırı yük (429/503) konunun suçu değil: 3 deneme sınırına sayılmasın diye topic_id yazılmaz.
    const transient = !recap.ok && /\b(429|503)\b/.test(recap.reason ?? '');
    const { error: recapLogError } = await supabase.from('ai_content_draft_worker_runs').insert({
      kind: 'recap_card',
      generated: recap.ok,
      // "Son Çalışmalar" listesinde içerik kayıtlarından ayırt edilsin.
      reason: `Hap bilgi kartı${recap.topicId ? ` (konu ${recap.topicId})` : ''}: ${recap.ok ? 'üretildi' : recap.reason}`,
      topic_id: transient ? null : (recap.topicId ?? null),
      worker: profile.id,
    });
    if (recapLogError) console.error('Kart çalışma kaydı yazılamadı:', recapLogError.message);
    return { ...result, recap };
  }

  return result;
}

// "Video / Sesli Anlatım" worker'ı: her çağrıda kuyruktaki ilk konuyu (anlatımı olmayan ya da içeriği
// değişmiş) seslendirir. Azure ücretsiz katmanı dakikada ~20 istek → ~50 cümlelik bir konu ~3-4 dk sürer;
// süre bütçesi dolarsa konu yarıda bırakılır, sonraki çağrı üretilmiş sesleri önbellekten alıp devam eder.
const NARRATION_WORK_BUDGET_MS = 230_000;

export async function runNarrationWorker(supabase: Supabase): Promise<{ status: number; body: Record<string, unknown> }> {
  const started = Date.now();
  const logRun = (row: { topic_id: number | null; outcome: string; screens_made?: number; screens_reused?: number; reason?: string | null }) =>
    supabase.from('topic_narration_worker_runs').insert(row);

  const { data: next, error: nextErr } = await supabase.rpc('next_topic_for_narration');
  if (nextErr) {
    await logRun({ topic_id: null, outcome: 'failed', reason: `kuyruk: ${nextErr.message}` });
    return { status: 500, body: { error: nextErr.message } };
  }
  const topicId = (next as { topic_id: number }[] | null)?.[0]?.topic_id;
  if (!topicId) {
    await logRun({ topic_id: null, outcome: 'idle' });
    return { status: 200, body: { outcome: 'idle' } };
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    await logRun({ topic_id: topicId, outcome: 'failed', reason: 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION tanımlı değil' });
    return { status: 500, body: { error: 'Azure yapılandırılmamış' } };
  }

  try {
    const engine = await createAzureEngine(key, region);
    const result = await generateTopicNarration(supabase, topicId, engine, { deadline: started + NARRATION_WORK_BUDGET_MS });
    if (result.completed) await revalidateTopicPage(supabase, topicId);
    await logRun({
      topic_id: topicId,
      outcome: result.completed ? 'completed' : 'partial',
      screens_made: result.made,
      screens_reused: result.reused,
      reason: result.completed ? `${engine.voice} · ${result.screenCount} ekran · ${Math.round((result.durationSeconds ?? 0) / 60)} dk` : 'süre doldu, sonraki çalıştırmada devam',
    });
    return { status: 200, body: { topicId, ...result } };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await logRun({ topic_id: topicId, outcome: 'failed', reason: reason.slice(0, 500) });
    return { status: 500, body: { topicId, error: reason } };
  }
}
