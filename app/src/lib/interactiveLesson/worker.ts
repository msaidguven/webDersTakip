import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuestionWorkerProfile } from '@/app/src/lib/questionWorkerProfiles';
import type { BatchStepResult } from '@/app/src/lib/topicQuestionBatch';
import { loadLessonSource } from './generate';
import { produceLessonV3 } from './generateV3';
import { HAND_WRITTEN_TOPIC_IDS } from './registry';
import type { LessonDefinitionV3 } from './typesV3';
import { voiceLesson } from './voice';
import { expireTag } from '@/app/src/lib/cacheInvalidation';
import { revalidateTopicPage } from '@/app/src/lib/topicPageRevalidation';
import { interactiveLessonTag } from './hydrate';

// Etkileşimli ders worker adımı (v3 Atom Keşif Dünyası — Tek-Bilgi + Kavram Avı + Havuz Soruları).
// Her çalışmada TEK iş:
//   1) dersi hazır ama Atom sesleri eksik konu varsa sesleri üretir (süre bitince kalanı sonraki çalışmaya),
//   2) yoksa sıradaki konunun v3 dersini üretir (her alt konu tek başına veya topluca üretilip doğrulanır).
// Mevcut yayındaki v1 derslere dokunmaz; bundan sonra üretilen tüm yeni dersler otomatik v3 olur.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;
type StoredLessonV3 = Omit<LessonDefinitionV3, 'topicId'>;

const STEP_BUDGET_MS = 250 * 1000;
const REQUEST_TIMEOUT_MS = 220 * 1000;
const SECTIONS_PER_V3_CALL = 2;
const TRANSIENT_ERROR = /\b(429|500|502|503|504)\b|fetch failed|ECONNRESET|ETIMEDOUT|timed? ?out|zaman aşımı|boş cevap/i;

async function update(supabase: Supabase, topicId: number, fields: Record<string, unknown>) {
  const msg = typeof fields.last_message === 'string' ? fields.last_message.slice(0, 2000) : undefined;
  await supabase
    .from('interactive_lessons')
    .update({ ...fields, ...(msg !== undefined ? { last_message: msg } : {}), updated_at: new Date().toISOString() })
    .eq('topic_id', topicId);
}

export async function runInteractiveLessonStep(supabase: Supabase, baseProfile: QuestionWorkerProfile): Promise<BatchStepResult | null> {
  const deadlineAt = Date.now() + STEP_BUDGET_MS;
  const voice = await runInteractiveVoiceStep(supabase, deadlineAt);
  if (voice && !voice.failed) return voice;
  const lesson = await runLessonGeneration(supabase, baseProfile, deadlineAt);
  if (!voice) return lesson;
  return lesson ? { ...lesson, reason: `${voice.reason} · ${lesson.reason ?? ''}` } : voice;
}

// 1) Ses borcu: hazır ders, sesleri eksik. Gemini kullanmaz — Gemini kotası doluyken de çalışır.
export async function runInteractiveVoiceStep(
  supabase: Supabase,
  deadlineAt = Date.now() + STEP_BUDGET_MS,
): Promise<(BatchStepResult & { failed?: boolean }) | null> {
  const { data: pendingVoice } = await supabase
    .from('interactive_lessons')
    .select('topic_id')
    .eq('status', 'ready')
    .eq('voice_done', false)
    .order('updated_at')
    .limit(1)
    .maybeSingle();
  if (pendingVoice && process.env.AZURE_SPEECH_KEY) {
    const topicId = (pendingVoice as { topic_id: number }).topic_id;
    const label = `Etkileşimli ders · Konu ${topicId} (robot sesi)`;
    try {
      const r = await voiceLesson(supabase, topicId, { deadlineAt });
      if (r.done) {
        await update(supabase, topicId, { voice_done: true });
        expireTag(interactiveLessonTag(topicId));
        await revalidateTopicPage(supabase, topicId).catch(() => {});
      }
      return {
        generated: r.made > 0,
        reason: `${label}: ${r.made} yeni ses${r.done ? `, tamam (${r.lines} cümle)` : ', devamı sonraki çalışmada'}`,
      };
    } catch (e) {
      return { generated: false, failed: true, reason: `${label}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  return null;
}

// Tek seferlik öncelikli konu (2026-11-28): 6. Sınıf Bilişim · İnternette İleri Düzey Arama (v3.2 pilot doğrulaması).
// Konunun aktif test soru havuzu (>=4 soru) hazırsa sıranın başına alınır; tamamlanınca
// (status = 'ready' veya 3 deneme) bir daha tetiklenmez, ardından 11. haftadan geriye normal akış devam eder.
const ONE_TIME_PRIORITY_TOPIC_ID = 578;

async function claimOneTimePriorityInteractiveTopic(supabase: Supabase): Promise<number | null> {
  const { data: existing } = await supabase
    .from('interactive_lessons')
    .select('status, runs, updated_at')
    .eq('topic_id', ONE_TIME_PRIORITY_TOPIC_ID)
    .maybeSingle();

  if (existing) {
    const row = existing as { status: string; runs: number; updated_at: string };
    const staleMs = Date.now() - Date.parse(row.updated_at);
    const retryable =
      row.runs < 3 &&
      (row.status === 'partial' ||
        (row.status === 'failed' && staleMs > 50 * 60 * 1000) ||
        (row.status === 'generating' && staleMs > 30 * 60 * 1000));
    if (!retryable) return null;
    const { data: claimed } = await supabase
      .from('interactive_lessons')
      .update({ status: 'generating', runs: row.runs + 1, updated_at: new Date().toISOString() })
      .eq('topic_id', ONE_TIME_PRIORITY_TOPIC_ID)
      .eq('status', row.status)
      .select('topic_id')
      .maybeSingle();
    return claimed ? ONE_TIME_PRIORITY_TOPIC_ID : null;
  }

  const { data: sections } = await supabase
    .from('topic_content_sections')
    .select('id, topic_contents!inner(topic_id, is_published)')
    .eq('topic_contents.topic_id', ONE_TIME_PRIORITY_TOPIC_ID)
    .eq('topic_contents.is_published', true);
  const sectionIds = ((sections as { id: number }[] | null) ?? []).map((s) => s.id);
  if (!sectionIds.length) return null;

  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .in('section_id', sectionIds)
    .eq('is_active', true)
    .in('question_type_id', [1, 3]);
  if ((count ?? 0) < 4) return null;

  const { error } = await supabase
    .from('interactive_lessons')
    .insert({ topic_id: ONE_TIME_PRIORITY_TOPIC_ID, status: 'generating', runs: 1 });
  return error ? null : ONE_TIME_PRIORITY_TOPIC_ID;
}

// 2) Sıradaki konunun v3 dersi (ya da yarım v3 dersin kalan bölümleri).
async function runLessonGeneration(
  supabase: Supabase,
  baseProfile: QuestionWorkerProfile,
  deadlineAt: number,
): Promise<BatchStepResult | null> {
  let topicId = await claimOneTimePriorityInteractiveTopic(supabase);
  if (topicId == null) {
    const { data: claimed, error: claimError } = await supabase.rpc('claim_next_interactive_lesson_topic', {
      p_exclude: HAND_WRITTEN_TOPIC_IDS,
    });
    if (claimError) return { generated: false, reason: `Etkileşimli ders: konu alınamadı: ${claimError.message}` };
    topicId = claimed as number | null;
  }
  if (topicId == null) return null;
  const label = `Etkileşimli ders v3 · Konu ${topicId}`;

  const { data: row } = await supabase
    .from('interactive_lessons')
    .select('runs, last_message, lesson')
    .eq('topic_id', topicId)
    .single();
  const { runs, lesson: rawPartial } = row as {
    runs: number;
    last_message: string | null;
    lesson: Partial<StoredLessonV3> | null;
  };
  const partial: StoredLessonV3 | null =
    rawPartial && rawPartial.version === 3 && Array.isArray(rawPartial.sections)
      ? (rawPartial as StoredLessonV3)
      : null;

  const source = await loadLessonSource(supabase, topicId);
  if ('error' in source) {
    await update(supabase, topicId, { status: 'failed', runs: 3, last_message: source.error });
    return { generated: false, reason: `${label}: ${source.error}` };
  }

  const doneIds = new Set((partial?.sections ?? []).map((sec) => sec.sectionId));
  const chunk = source.sections.filter((sec) => !doneIds.has(sec.id)).slice(0, SECTIONS_PER_V3_CALL);
  const profile: QuestionWorkerProfile = { ...baseProfile, requestTimeoutMs: REQUEST_TIMEOUT_MS, deadlineAt };

  try {
    const out = await produceLessonV3({ ...source, sections: chunk }, profile);
    if (out.errors.length) {
      const message = `Denetim (v3): ${out.errors.slice(0, 20).join('\n')}`;
      await update(supabase, topicId, { status: 'failed', model: out.model, last_message: message });
      return {
        generated: false,
        reason: `${label} "${source.title}": ${out.errors.length} denetim hatası (deneme ${runs}/3)`,
      };
    }

    const order = new Map(source.sections.map((sec, i) => [sec.id, i]));
    const sections = [...(partial?.sections ?? []), ...out.lesson.sections].sort(
      (a, b) => (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0),
    );
    const stored: StoredLessonV3 = {
      version: 3,
      schemaVersion: '3.2',
      courseLabel: out.lesson.courseLabel,
      sceneId: 'generic',
      guide: partial?.guide ?? out.lesson.guide,
      sections,
    };
    const finished = sections.length >= source.sections.length;
    const totalBeats = sections.reduce((sum, sec) => sum + sec.beats.length, 0);
    const summary = `v3.2: ${sections.length}/${source.sections.length} bölüm, ${totalBeats} sahne`;

    await update(supabase, topicId, {
      status: finished ? 'ready' : 'partial',
      lesson: stored,
      model: out.model,
      runs: 0,
      voice_done: false,
      last_message: summary,
    });

    return {
      generated: true,
      reason: `${label} "${source.title}": ${
        finished ? `hazır (${summary}), robot sesleri sonraki çalışmada` : `${summary}, devamı sonraki çalışmada`
      } · ${out.calls} AI çağrısı`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const transient = TRANSIENT_ERROR.test(message);
    await update(supabase, topicId, {
      status: 'failed',
      last_message: message,
      ...(transient ? { runs: Math.max(0, runs - 1) } : {}),
    });
    return { generated: false, reason: `${label}: ${message}` };
  }
}
