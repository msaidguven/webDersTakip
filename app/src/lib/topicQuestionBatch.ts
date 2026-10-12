// app/src/lib/topicQuestionBatch.ts
// Konu bazlı otomatik soru partisi (2026-10-12, kullanıcı kararı): soru worker'ı her çağrıda TEK
// adım yapar — claim_next_topic_batch_step RPC'si (supabase/migrations/ai_topic_question_batches.sql)
// sıradaki adımı kilitle kapar (3 tur; tur başına alt başlıklar + konu geneli — bkz.
// ai_topic_question_batch_rounds.sql):
//   section → alt başlığa soru + AI kontrolü ('batched', yayında değil)
//   topic   → konu geneli 10-15 soru + AI kontrolü
//   publish → konunun bütün taslakları tek seferde soru bankasına, önbellek konu için BİR kez yenilenir
// Admin onayı yok; güvenlik: zorunlu AI kontrolü + öğrencinin "Hatalı soru bildir" düğmesi
// (question_reports.sql). SVG isteyen sorular çizim eklenene kadar pasif (admin panel uyarısı).
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateBatchSectionDraft, generateBatchTopicDraft } from '@/app/src/lib/aiQuestionDraftGen';
import { insertQuestions, sectionOutcomeIds, topicOutcomeIds } from '@/app/src/lib/questionInsert';
import { parseQuestions } from '@/app/src/lib/parseMixedQuestions';
import { revalidateHomepage, revalidateUnitPagesForTopics } from '@/app/src/lib/topicPageRevalidation';
import type { QuestionWorkerProfile } from '@/app/src/lib/questionWorkerProfiles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

type Step =
  | { kind: 'section'; draft_id: number; topic_id: number; round_no: number; section_id: number }
  | { kind: 'topic'; draft_id: number; topic_id: number; round_no: number }
  | { kind: 'publish'; topic_id: number; round_no: number }
  | { kind: 'wait'; topic_id: number; round_no: number }
  | { kind: 'none' };

export interface BatchStepResult {
  generated: boolean;
  reason?: string;
  draftId?: number;
}

async function markDraftFailed(supabase: Supabase, draftId: number, reason: string) {
  await supabase.from('ai_question_drafts').update({ status: 'failed', fail_reason: reason.slice(0, 500) }).eq('id', draftId).eq('status', 'generating');
}

// Geçici hata (kota 429, yoğunluk 503/500, ağ, zaman aşımı): içerikle ilgisi yok, adım deneme hakkı
// YAKMAZ — kapılan satır silinir, sonraki çalışmada aynı adım yeniden denenir. 2026-10-12 gecesi 3 konu
// yalnız Gemini 429/503 yüzünden 2 hakkını yakıp turu 0 soruyla "başarısız" kapatmıştı.
const TRANSIENT_ERROR = /\b(429|500|502|503|504)\b|fetch failed|ECONNRESET|ETIMEDOUT|timed? ?out|zaman aşımı|boş cevap/i;

async function releaseDraft(supabase: Supabase, draftId: number) {
  await supabase.from('ai_question_drafts').delete().eq('id', draftId).eq('status', 'generating');
}

export async function runTopicBatchStep(supabase: Supabase, profile: QuestionWorkerProfile): Promise<BatchStepResult> {
  const { data, error } = await supabase.rpc('claim_next_topic_batch_step');
  if (error) return { generated: false, reason: `Parti adımı alınamadı: ${error.message}` };
  const step = data as Step;

  switch (step.kind) {
    case 'none':
      return { generated: false, reason: 'Soru üretilecek yeni konu yok' };
    case 'wait':
      return { generated: false, reason: `Konu ${step.topic_id} (${step.round_no}. tur): başka bir worker üretiyor, bekleniyor` };
    case 'section':
    case 'topic': {
      const result =
        step.kind === 'section'
          ? await generateBatchSectionDraft(supabase, step.section_id, step.draft_id, profile)
          : await generateBatchTopicDraft(supabase, step.topic_id, step.draft_id, profile);
      if (!result.generated) {
        const reason = result.reason ?? 'bilinmeyen hata';
        if (TRANSIENT_ERROR.test(reason)) await releaseDraft(supabase, step.draft_id);
        else await markDraftFailed(supabase, step.draft_id, reason);
      }
      const label = step.kind === 'section' ? `Konu ${step.topic_id} (${step.round_no}. tur) / alt başlık ${step.section_id}` : `Konu ${step.topic_id} (${step.round_no}. tur) / konu geneli`;
      return { generated: result.generated, draftId: step.draft_id, reason: result.generated ? `${label}: taslak hazır (yayın bekliyor)` : `${label}: ${result.reason}` };
    }
    case 'publish':
      return publishTopicBatch(supabase, step.topic_id, step.round_no);
  }
}

// Yayından önce Claude incelemesi bekleyen dersler (2026-10-12, kullanıcı kararı: Türkçe'de uzman
// yok, AI kontrolü tek başına yetmedi). Parti 'awaiting_review' olur; admin "Yayınla" → force.
const REVIEW_HOLD_LESSON_SLUGS = new Set(['turkce']);

type Embed<T> = T | T[] | null | undefined;
const first = <T,>(v: Embed<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

async function topicLessonSlug(supabase: Supabase, topicId: number): Promise<string | null> {
  const { data } = await supabase.from('topics').select('units!inner(lessons!inner(slug))').eq('id', topicId).maybeSingle();
  const row = data as { units: Embed<{ lessons: Embed<{ slug: string | null }> }> } | null;
  return first(first(row?.units)?.lessons)?.slug ?? null;
}

export async function publishTopicBatch(supabase: Supabase, topicId: number, roundNo: number, opts: { force?: boolean } = {}): Promise<BatchStepResult> {
  if (!opts.force && REVIEW_HOLD_LESSON_SLUGS.has((await topicLessonSlug(supabase, topicId)) ?? '')) {
    await supabase.from('ai_topic_question_batches').update({ status: 'awaiting_review', claimed_at: null }).eq('topic_id', topicId).eq('round_no', roundNo);
    return { generated: false, reason: `Konu ${topicId} (${roundNo}. tur): taslaklar hazır, yayından önce inceleme bekliyor` };
  }
  const { data: draftRows, error } = await supabase
    .from('ai_question_drafts')
    .select('id, section_id, ai_model, questions')
    .eq('batch_topic_id', topicId)
    .eq('batch_round', roundNo)
    .eq('status', 'batched')
    .order('section_id', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });
  if (error) {
    await supabase.from('ai_topic_question_batches').update({ status: 'collecting', claimed_at: null, last_error: error.message }).eq('topic_id', topicId).eq('round_no', roundNo);
    return { generated: false, reason: `Konu ${topicId}: taslaklar okunamadı: ${error.message}` };
  }
  const drafts = (draftRows as { id: number; section_id: number | null; ai_model: string | null; questions: unknown }[] | null) || [];

  const topicOutcomes = (await topicOutcomeIds(supabase, topicId)) ?? [];
  let saved = 0;
  let svgPending = 0;
  const errors: string[] = [];

  for (const d of drafts) {
    const questions = parseQuestions({ questions: d.questions }, 20);
    if (!questions) {
      await supabase.from('ai_question_drafts').update({ status: 'failed', fail_reason: 'Yayın sırasında şema hatası' }).eq('id', d.id);
      errors.push(`taslak ${d.id}: şema`);
      continue;
    }
    const sectionOutcomes = d.section_id != null ? await sectionOutcomeIds(supabase, d.section_id) : null;
    const outcomeIds = sectionOutcomes?.length ? sectionOutcomes : topicOutcomes;
    const result = await insertQuestions(supabase, { topicId, sectionId: d.section_id, outcomeIds, questions, aiModel: d.ai_model });
    // Yarıda kalan taslak tekrar denenmez (aynı soruları ikinci kez yazmasın) — 'failed' olarak kalır.
    await supabase
      .from('ai_question_drafts')
      .update(result.ok ? { status: 'auto_published', reviewed_at: new Date().toISOString() } : { status: 'failed', fail_reason: result.error })
      .eq('id', d.id);
    saved += result.savedCount;
    if (result.ok) svgPending += result.svgPendingCount;
    else errors.push(`taslak ${d.id}: ${result.error}`);
  }

  await supabase
    .from('ai_topic_question_batches')
    .update({
      status: saved > 0 ? 'published' : 'failed',
      published_at: new Date().toISOString(),
      question_count: saved,
      svg_pending_count: svgPending,
      last_error: errors.length ? errors.join(' · ').slice(0, 1000) : saved > 0 ? null : 'Hiç soru üretilemedi',
    })
    .eq('topic_id', topicId)
    .eq('round_no', roundNo);

  // Konu için TEK önbellek yenilemesi (konu/ünite/ders/soru bankası sayfaları + anasayfa).
  if (saved > 0) {
    await revalidateUnitPagesForTopics(supabase, [topicId]);
    revalidateHomepage();
  }
  return {
    generated: saved > 0,
    reason: `Konu ${topicId} (${roundNo}. tur): ${saved} soru yayınlandı${svgPending ? `, ${svgPending} soru çizim bekliyor` : ''}${errors.length ? ` (hatalar: ${errors.join(' · ')})` : ''}`,
  };
}
