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

// Vercel 300 sn'de fonksiyonu log yazamadan öldürüyordu; RPC 10 dk sonra taslağı "zaman aşımı" diye başarısız
// sayıp deneme hakkı yakıyordu (2026-10-28: son 30 günde parti taslaklarının %16'sı). Bütçe bitince Gemini
// çağrısı "zaman aşımı" hatası atar → TRANSIENT_ERROR → taslak serbest bırakılır, hak yanmaz, sonuç loglanır.
const STEP_BUDGET_MS = 240 * 1000;
const REQUEST_TIMEOUT_MS = 120 * 1000;

export async function runTopicBatchStep(supabase: Supabase, baseProfile: QuestionWorkerProfile): Promise<BatchStepResult> {
  const profile: QuestionWorkerProfile = { ...baseProfile, requestTimeoutMs: REQUEST_TIMEOUT_MS, deadlineAt: Date.now() + STEP_BUDGET_MS };
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
      const label = step.kind === 'section' ? `Konu ${step.topic_id} (${step.round_no}. tur) / alt başlık ${step.section_id}` : `Konu ${step.topic_id} (${step.round_no}. tur) / konu geneli`;
      let reason: string;
      try {
        const result =
          step.kind === 'section'
            ? await generateBatchSectionDraft(supabase, step.section_id, step.draft_id, profile)
            : await generateBatchTopicDraft(supabase, step.topic_id, step.draft_id, profile);
        if (result.generated) return { generated: true, draftId: step.draft_id, reason: `${label}: taslak hazır (yayın bekliyor)` };
        reason = result.reason ?? 'bilinmeyen hata';
      } catch (e) {
        // Beklenmeyen istisna da taslağı 'generating' bırakmasın — aşağıdaki sınıflandırma uygulanır.
        reason = e instanceof Error ? e.message : String(e);
      }
      // Geçici hata: satır silinir, deneme hakkı yakılmaz → draftId dönmez (log'a silinmiş id yazılmasın).
      if (TRANSIENT_ERROR.test(reason)) {
        await releaseDraft(supabase, step.draft_id);
        return { generated: false, reason: `${label}: ${reason}` };
      }
      await markDraftFailed(supabase, step.draft_id, reason);
      return { generated: false, draftId: step.draft_id, reason: `${label}: ${reason}` };
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

// Turda hiç başarılı taslağı olmayan adımlar (geçici hatalar hak yakmadığı için bunlar kalıcı hatadır: içerik/kitap
// yok, AI çıktısı iki kez şemaya uymadı, kayıt hatası…). Admin panelinde partinin hata sütununda görünür.
async function skippedSteps(supabase: Supabase, topicId: number, roundNo: number): Promise<string[]> {
  const { data } = await supabase
    .from('ai_question_drafts')
    .select('section_id, status, fail_reason')
    .eq('batch_topic_id', topicId)
    .eq('batch_round', roundNo);
  const rows = (data as { section_id: number | null; status: string; fail_reason: string | null }[] | null) || [];
  const done = new Set(rows.filter((r) => r.status === 'auto_published').map((r) => r.section_id ?? 0));
  const reasons = new Map<number, string>();
  for (const r of rows) if (r.status === 'failed' && !done.has(r.section_id ?? 0)) reasons.set(r.section_id ?? 0, r.fail_reason ?? 'bilinmeyen hata');
  if (!reasons.size) return [];
  const ids = [...reasons.keys()].filter((id) => id !== 0);
  const { data: secData } = ids.length ? await supabase.from('topic_content_sections').select('id, heading').in('id', ids) : { data: [] };
  const heading = new Map(((secData as { id: number; heading: string }[] | null) || []).map((h) => [h.id, h.heading]));
  return [...reasons.entries()].map(([id, reason]) => `${id === 0 ? 'konu geneli' : `"${heading.get(id) ?? id}"`} (${reason.slice(0, 150)})`);
}

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

  for (const d of drafts) {
    const questions = parseQuestions({ questions: d.questions }, 20);
    if (!questions) {
      await supabase.from('ai_question_drafts').update({ status: 'failed', fail_reason: 'Yayın sırasında şema hatası' }).eq('id', d.id);
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
  }

  // Yeniden açılan turda (claim RPC) önceki yayının soruları da sayılır.
  const { data: prevRow } = await supabase
    .from('ai_topic_question_batches')
    .select('question_count, svg_pending_count')
    .eq('topic_id', topicId)
    .eq('round_no', roundNo)
    .maybeSingle();
  const prev = prevRow as { question_count: number | null; svg_pending_count: number | null } | null;
  const total = (prev?.question_count ?? 0) + saved;
  const skipped = await skippedSteps(supabase, topicId, roundNo);

  await supabase
    .from('ai_topic_question_batches')
    .update({
      status: total > 0 ? 'published' : 'failed',
      published_at: new Date().toISOString(),
      question_count: total,
      svg_pending_count: (prev?.svg_pending_count ?? 0) + svgPending,
      last_error: skipped.length ? `Atlandı: ${skipped.join(' · ')}`.slice(0, 1000) : total > 0 ? null : 'Hiç soru üretilemedi',
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
    reason: `Konu ${topicId} (${roundNo}. tur): ${saved} soru yayınlandı${svgPending ? `, ${svgPending} soru çizim bekliyor` : ''}${skipped.length ? ` (atlandı: ${skipped.join(' · ')})` : ''}`,
  };
}
