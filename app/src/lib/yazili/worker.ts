// Otomatik yazılı soruları (2026-10-31, kullanıcı kararı): yazılıya ayrılan soru worker'ı her çalışmada önce
// buraya bakar — yayındaki yazılıların v1 sorusu eksik konusundan birini alır (claim_next_yazili_topic,
// supabase/migrations/yazili_generation_draft.sql). Her çalışma TEK AI çağrısı yapar (ikisi birlikte 238 sn
// sürdü, Vercel sınırı 300):
//   taslak yok → admin'in kopyaladığı promptun aynısıyla üretir, taslağı yazili_generation_runs.draft'a saklar
//   taslak var → aynı standarda göre denetletir, v1 olarak doğrudan yayına alır (admin onayı yok; güvenlik:
//                AI kontrolü + "Hatalı soru bildir"). SVG isteyen sorular çizim eklenene kadar pasif kalır.
// İş yoksa null döner, worker test partisine geçer.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateGeminiJson } from '@/app/src/lib/geminiJsonGen';
import { prettyModelName } from '@/app/src/lib/geminiWorkerProfile';
import { parseQuestions, type ParsedClassical } from '@/app/src/lib/parseMixedQuestions';
import { insertQuestions } from '@/app/src/lib/questionInsert';
import type { QuestionWorkerProfile } from '@/app/src/lib/questionWorkerProfiles';
import type { BatchStepResult } from '@/app/src/lib/topicQuestionBatch';
import { YAZILI_PROMPT_VERSION } from '@/app/src/lib/yazili/common';
import { buildYaziliPrompt, buildYaziliReviewPrompt, loadYaziliTopicInfo } from '@/app/src/lib/yazili/prompt';
import { loadTopicOutcomes, resolveYaziliItems, revalidateYaziliPages } from '@/app/src/lib/yazili/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

const MAX_QUESTIONS = 30;
// Süre bütçesi ve geçici hata ayrımı test partisiyle aynı (bkz. topicQuestionBatch.ts).
const STEP_BUDGET_MS = 240 * 1000;
const REQUEST_TIMEOUT_MS = 120 * 1000;
const TRANSIENT_ERROR = /\b(429|500|502|503|504)\b|fetch failed|ECONNRESET|ETIMEDOUT|timed? ?out|zaman aşımı|boş cevap/i;

type Draft = { questions: unknown[]; model: string };
type RunUpdate = { status: 'idle' | 'done' | 'failed' | 'skipped'; last_message: string; draft?: Draft | null; runs?: number };

async function updateRun(supabase: Supabase, topicId: number, update: RunUpdate) {
  await supabase.from('yazili_generation_runs').update({ ...update, last_message: update.last_message.slice(0, 500) }).eq('topic_id', topicId);
}

export async function runYaziliStep(supabase: Supabase, baseProfile: QuestionWorkerProfile): Promise<BatchStepResult | null> {
  const profile: QuestionWorkerProfile = { ...baseProfile, requestTimeoutMs: REQUEST_TIMEOUT_MS, deadlineAt: Date.now() + STEP_BUDGET_MS };
  const { data, error } = await supabase.rpc('claim_next_yazili_topic');
  if (error) return { generated: false, reason: `Yazılı: konu alınamadı: ${error.message}` };
  const topicId = data as number | null;
  if (topicId == null) return null;

  const { data: runData } = await supabase.from('yazili_generation_runs').select('runs, draft').eq('topic_id', topicId).single();
  const run = runData as { runs: number; draft: Draft | null };
  return run.draft ? reviewAndPublish(supabase, topicId, run.draft, profile) : generateDraft(supabase, topicId, run.runs, profile);
}

async function generateDraft(supabase: Supabase, topicId: number, runs: number, profile: QuestionWorkerProfile): Promise<BatchStepResult> {
  const label = `Yazılı · Konu ${topicId} (taslak)`;
  // Ders notu varsa ondan, yoksa konunun test sorularından.
  let built = await buildYaziliPrompt(supabase, topicId, { source: 'content' });
  if (!built.ok && built.code === 'no_source') built = await buildYaziliPrompt(supabase, topicId, { source: 'questions' });
  if (!built.ok) {
    await updateRun(supabase, topicId, { status: 'skipped', last_message: built.error });
    return { generated: false, reason: `${label}: ${built.error}` };
  }

  try {
    const draft = await generateGeminiJson(built.prompt, profile);
    const questions = (draft.data as { questions?: unknown } | null)?.questions;
    if (!Array.isArray(questions) || !parseQuestions(draft.data, MAX_QUESTIONS)) throw new Error('Taslak beklenen JSON şemasına uymadı');
    const message = `${questions.length} soruluk taslak hazır, denetim sonraki çalışmada`;
    await updateRun(supabase, topicId, { status: 'idle', last_message: message, draft: { questions, model: draft.model } });
    return { generated: true, reason: `${label}: ${message}` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Geçici hata (kota/yoğunluk/zaman aşımı) tur hakkı yakmaz; sonraki çalışmada aynı konu yeniden denenir.
    const transient = TRANSIENT_ERROR.test(message);
    await updateRun(supabase, topicId, { status: transient ? 'idle' : 'failed', last_message: message, ...(transient ? { runs: Math.max(0, runs - 1) } : {}) });
    return { generated: false, reason: `${label}: ${message}` };
  }
}

async function reviewAndPublish(supabase: Supabase, topicId: number, draft: Draft, profile: QuestionWorkerProfile): Promise<BatchStepResult> {
  const label = `Yazılı · Konu ${topicId} (denetim)`;
  const [topic, outcomes] = await Promise.all([
    loadYaziliTopicInfo(supabase, topicId),
    loadTopicOutcomes(supabase, [topicId]).then((m) => m.get(topicId) ?? []),
  ]);
  if (!topic || !outcomes.length) {
    const message = !topic ? 'Konu bulunamadı' : 'Bu konunun güncel kazanımı yok';
    await updateRun(supabase, topicId, { status: 'skipped', last_message: message, draft: null });
    return { generated: false, reason: `${label}: ${message}` };
  }

  let review;
  try {
    review = await generateGeminiJson(await buildYaziliReviewPrompt(topic, outcomes, draft.questions), profile);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Geçici hatada taslak korunur, sonraki çalışma yalnız denetimi yeniden dener; kalıcı hatada taslak atılır.
    const transient = TRANSIENT_ERROR.test(message);
    await updateRun(supabase, topicId, { status: transient ? 'idle' : 'failed', last_message: message, ...(transient ? {} : { draft: null }) });
    return { generated: false, reason: `${label}: ${message}` };
  }

  const parsed = parseQuestions(review.data, MAX_QUESTIONS);
  if (!parsed?.length || parsed.some((q) => q.kind !== 'classical')) {
    const message = 'Denetim çıktısı beklenen JSON şemasına uymadı, taslak atıldı';
    await updateRun(supabase, topicId, { status: 'failed', last_message: message, draft: null });
    return { generated: false, reason: `${label}: ${message}` };
  }
  const raw = (review.data as { questions: Record<string, unknown>[] }).questions;
  const items = resolveYaziliItems(parsed as ParsedClassical[], raw, outcomes).filter((it) => it.outcomeId != null);

  // Kayıt yarıda kalırsa taslak yine atılır: aynı taslağı yeniden yazmak kaydedilenleri çiftler.
  const aiModel = `${prettyModelName(draft.model)} (otomatik yazılı)`;
  let saved = 0;
  let svgPending = 0;
  let insertError: string | null = null;
  for (const it of items) {
    const res = await insertQuestions(supabase, {
      topicId, sectionId: null, outcomeIds: [it.outcomeId as number], questions: [it.q], aiModel, difficulty: it.difficulty, promptVersion: YAZILI_PROMPT_VERSION,
    });
    if (!res.ok) {
      insertError = res.error;
      break;
    }
    saved += res.savedCount;
    svgPending += res.svgPendingCount;
  }
  if (saved) revalidateYaziliPages();

  const dropped = parsed.length - items.length;
  const message = [
    `${saved} v1 soru eklendi`,
    svgPending ? `${svgPending} çizim bekliyor` : '',
    dropped ? `${dropped} kazanımsız soru atlandı` : '',
    insertError ? `kayıt hatası: ${insertError}` : '',
  ].filter(Boolean).join(', ');
  await updateRun(supabase, topicId, { status: insertError || !saved ? 'failed' : 'done', last_message: message, draft: null });
  return { generated: saved > 0, reason: `${label}: ${message}` };
}
