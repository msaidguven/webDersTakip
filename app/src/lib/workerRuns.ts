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
  // konularda kart içerikle aynı çağrıda geliyor). Kartı eksik konu da yoksa boşta kalmak yerine
  // test soru havuzuna destek olur (tertiary'nin 3.8-flash kotasıyla çakışmamak için 3.6 + 3.5-flash kullanır).
  if (result.idle) {
    const recap = await generateNextRecapCards(supabase, profile);
    const recapIdle = !recap.ok && !recap.topicId && recap.reason === 'Kartı eksik konu yok';

    if (recapIdle) {
      const qSupportProfile = {
        ...QUESTION_WORKER_PROFILES.primary,
        model: 'gemini-3.6-flash',
        fallbackModels: ['gemini-3.5-flash'],
        apiKeyEnvs: profile.apiKeyEnvs,
      };
      const qStep = await runTopicBatchStep(supabase, qSupportProfile);
      const { error: qLogError } = await supabase.from('ai_content_draft_worker_runs').insert({
        kind: 'question_pool',
        generated: qStep.generated,
        reason: `Soru havuzu desteği: ${qStep.reason ?? (qStep.generated ? 'üretildi' : 'iş yok')}`,
        topic_id: null,
        worker: profile.id,
      });
      if (qLogError) console.error('Soru havuzu desteği kaydı yazılamadı:', qLogError.message);
      return { ...result, recap: { ok: qStep.generated, topicId: undefined, reason: qStep.reason } };
    }

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

// "Video / Sesli Anlatım" otomatik worker'ı durduruldu (kullanıcı kararı 2026-11-21):
// Mevcut üretilmiş sesli anlatımlar yayında kalır; yeni konular için Azure TTS kotası
// yalnızca Etkileşimli Derslere (runInteractiveVoiceStep) ayrılır.
export async function runNarrationWorker(_supabase: Supabase): Promise<{ status: number; body: Record<string, unknown> }> {
  void _supabase;
  return {
    status: 200,
    body: {
      outcome: 'paused',
      reason: 'Yeni sesli anlatım üretimi durduruldu; Azure kotası etkileşimli derslere ayrıldı.',
    },
  };
}
