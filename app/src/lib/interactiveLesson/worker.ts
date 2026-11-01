import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuestionWorkerProfile } from '@/app/src/lib/questionWorkerProfiles';
import type { BatchStepResult } from '@/app/src/lib/topicQuestionBatch';
import { loadLessonSource, produceLesson, SECTIONS_PER_CALL, summarizeBlocks } from './generate';
import { HAND_WRITTEN_TOPIC_IDS } from './registry';
import type { LessonDefinition } from './types';
import { voiceLesson } from './voice';

// Etkileşimli ders worker adımı (2026-11-01, kullanıcı kararı: 2. soru worker'ı bu işe ayrıldı; bkz.
// supabase/migrations/interactive_lesson_generation.sql). Her çalışmada TEK iş:
//   1) dersi hazır ama Bit sesleri eksik konu varsa sesleri üretir (süre bitince kalanı sonraki çalışmaya),
//   2) yoksa sıradaki konunun dersini üretir: her çalışmada tek alt konu (önceki bölümlerin özetiyle), her parça
//      denetlenir; geçemezse hata listesi saklanır ve sonraki deneme o hatalarla düzelttirilir.
// İş yoksa null döner, worker soru partisine geçer.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;
type StoredLesson = Omit<LessonDefinition, 'topicId'>;

const STEP_BUDGET_MS = 250 * 1000;
const REQUEST_TIMEOUT_MS = 230 * 1000;
const TRANSIENT_ERROR = /\b(429|500|502|503|504)\b|fetch failed|ECONNRESET|ETIMEDOUT|timed? ?out|zaman aşımı|boş cevap/i;

async function update(supabase: Supabase, topicId: number, fields: Record<string, unknown>) {
  const msg = typeof fields.last_message === 'string' ? fields.last_message.slice(0, 2000) : undefined;
  await supabase.from('interactive_lessons').update({ ...fields, ...(msg !== undefined ? { last_message: msg } : {}), updated_at: new Date().toISOString() }).eq('topic_id', topicId);
}

export async function runInteractiveLessonStep(supabase: Supabase, baseProfile: QuestionWorkerProfile): Promise<BatchStepResult | null> {
  const deadlineAt = Date.now() + STEP_BUDGET_MS;
  return (await runInteractiveVoiceStep(supabase, deadlineAt)) ?? (await runLessonGeneration(supabase, baseProfile, deadlineAt));
}

// 1) Ses borcu: hazır ders, sesleri eksik. Gemini kullanmaz — Gemini kotası doluyken de çalışır (route).
export async function runInteractiveVoiceStep(supabase: Supabase, deadlineAt = Date.now() + STEP_BUDGET_MS): Promise<BatchStepResult | null> {
  const { data: pendingVoice } = await supabase.from('interactive_lessons').select('topic_id').eq('status', 'ready').eq('voice_done', false).order('updated_at').limit(1).maybeSingle();
  if (pendingVoice && process.env.AZURE_SPEECH_KEY) {
    const topicId = (pendingVoice as { topic_id: number }).topic_id;
    const label = `Etkileşimli ders · Konu ${topicId} (Bit sesi)`;
    try {
      const r = await voiceLesson(supabase, topicId, { deadlineAt });
      if (r.done) await update(supabase, topicId, { voice_done: true });
      return { generated: r.made > 0, reason: `${label}: ${r.made} yeni ses${r.done ? `, tamam (${r.lines} cümle)` : ', devamı sonraki çalışmada'}` };
    } catch (e) {
      return { generated: false, reason: `${label}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return null;
}

// 2) Sıradaki konunun dersi (ya da yarım dersin sıradaki parçası).
async function runLessonGeneration(supabase: Supabase, baseProfile: QuestionWorkerProfile, deadlineAt: number): Promise<BatchStepResult | null> {
  const { data: claimed, error: claimError } = await supabase.rpc('claim_next_interactive_lesson_topic', { p_exclude: HAND_WRITTEN_TOPIC_IDS });
  if (claimError) return { generated: false, reason: `Etkileşimli ders: konu alınamadı: ${claimError.message}` };
  const topicId = claimed as number | null;
  if (topicId == null) return null;
  const label = `Etkileşimli ders · Konu ${topicId}`;

  const { data: row } = await supabase.from('interactive_lessons').select('runs, last_message, lesson').eq('topic_id', topicId).single();
  const { runs, last_message: lastMessage, lesson: partial } = row as { runs: number; last_message: string | null; lesson: StoredLesson | null };
  const source = await loadLessonSource(supabase, topicId);
  if ('error' in source) {
    // Kaynak eksikliği yeniden denemeyle düzelmez: hakkı bitir.
    await update(supabase, topicId, { status: 'failed', runs: 3, last_message: source.error });
    return { generated: false, reason: `${label}: ${source.error}` };
  }

  // Önceki çalışmalarda üretilen bölümler saklı; sıradaki alt konu üretilir.
  const done = new Set((partial?.blocks ?? []).map((b) => b.sectionId));
  const chunk = source.sections.filter((sec) => !done.has(sec.id)).slice(0, SECTIONS_PER_CALL);
  const part = { first: done.size === 0, of: source.sections.length, previous: partial?.blocks.length ? summarizeBlocks(partial.blocks) : undefined };
  const profile: QuestionWorkerProfile = { ...baseProfile, requestTimeoutMs: REQUEST_TIMEOUT_MS, deadlineAt };
  try {
    // Önceki deneme denetimden geçemediyse aynı hatalar düzelttirilir.
    const previousErrors = runs > 1 && lastMessage?.startsWith('Denetim:') ? lastMessage.slice('Denetim:'.length).trim() : undefined;
    const out = await produceLesson({ ...source, sections: chunk }, profile, previousErrors, part);
    if (out.errors.length) {
      const message = `Denetim: ${out.errors.slice(0, 25).join('\n')}`;
      await update(supabase, topicId, { status: 'failed', model: out.model, last_message: message });
      return { generated: false, reason: `${label} "${source.title}": ${out.errors.length} denetim hatası (deneme ${runs}/3)` };
    }
    const order = new Map(source.sections.map((sec, i) => [sec.id, i]));
    const blocks = [...(partial?.blocks ?? []), ...out.lesson.blocks].sort((a, b) => (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0));
    const stored: StoredLesson = { guide: partial?.guide ?? out.lesson.guide, blocks };
    const finished = blocks.length >= source.sections.length;
    const steps = blocks.reduce((n, b) => n + b.steps.length, 0);
    const summary = `${blocks.length}/${source.sections.length} bölüm, ${steps} adım`;
    // Başarılı parça art arda başarısızlık sayacını sıfırlar.
    await update(supabase, topicId, { status: finished ? 'ready' : 'partial', lesson: stored, model: out.model, runs: 0, voice_done: false, last_message: summary });
    return {
      generated: true,
      reason: `${label} "${source.title}": ${finished ? `hazır (${summary}), Bit sesleri sonraki çalışmada` : `${summary}, devamı sonraki çalışmada`} · ${out.calls} AI çağrısı`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Geçici hata (kota/yoğunluk/zaman aşımı) hak yakmaz.
    const transient = TRANSIENT_ERROR.test(message);
    await update(supabase, topicId, { status: 'failed', last_message: message, ...(transient ? { runs: Math.max(0, runs - 1) } : {}) });
    return { generated: false, reason: `${label}: ${message}` };
  }
}
