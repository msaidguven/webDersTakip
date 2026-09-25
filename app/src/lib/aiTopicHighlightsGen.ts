import { readFile } from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sortOutcomesByWeek } from '@/app/src/lib/outcomeCodes';
import { generateTopicContentJson } from '@/app/src/lib/geminiContentGen';
import { cleanHighlights, replaceHighlights, type IncomingHighlight } from '@/app/src/lib/topicContentHighlights';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

type EligibleRow = { topic_id: number; topic_content_id: number; unit_id: number; lesson_id: number; grade_id: number };

export interface TopicHighlightsGenerationResult {
  generated: boolean;
  reason?: string;
  topicId?: number;
}

function parseHighlights(raw: unknown): IncomingHighlight[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const list = (raw as Record<string, unknown>).highlights;
  if (!Array.isArray(list) || !list.length) return null;
  return list as IncomingHighlight[];
}

// content-draft worker'ıyla (aiContentDraftGen.ts) AYNI desen: uygun bir sonraki konuyu
// seç, promptu doldur, Gemini'den JSON al, doğrudan yayınla (kullanıcının 2026-09-25
// isteği: bu da onay beklemeden otomatik yayınlansın).
export async function generateNextTopicHighlights(supabase: Supabase): Promise<TopicHighlightsGenerationResult> {
  const { data: eligibleRows, error: eligibleError } = await supabase.rpc('find_next_topic_missing_highlights');
  if (eligibleError) return { generated: false, reason: `Uygun konu sorgusu başarısız: ${eligibleError.message}` };

  const eligible = (eligibleRows as EligibleRow[] | null)?.[0];
  if (!eligible) return { generated: false, reason: 'Anahtar kavramı eksik konu yok' };

  const [{ data: topicRow }, { data: unitRow }, { data: lessonRow }, { data: gradeRow }, { data: sectionsData }] = await Promise.all([
    supabase.from('topics').select('id, title').eq('id', eligible.topic_id).maybeSingle(),
    supabase.from('units').select('id, title').eq('id', eligible.unit_id).maybeSingle(),
    supabase.from('lessons').select('id, name').eq('id', eligible.lesson_id).maybeSingle(),
    supabase.from('grades').select('id, name').eq('id', eligible.grade_id).maybeSingle(),
    supabase
      .from('topic_content_sections')
      .select('heading, body_markdown, order_no')
      .eq('topic_content_id', eligible.topic_content_id)
      .order('order_no', { ascending: true }),
  ]);
  if (!topicRow || !unitRow || !lessonRow || !gradeRow) {
    return { generated: false, reason: 'Konu/ünite/ders/sınıf kaydı okunamadı' };
  }

  const sections = (sectionsData as { heading: string; body_markdown: string | null }[] | null) || [];
  const topicContentText = sections
    .filter((s) => s.body_markdown?.trim())
    .map((s) => `### ${s.heading}\n${s.body_markdown}`)
    .join('\n\n');

  const { data: outcomeRows } = await supabase
    .from('outcomes')
    .select('id, description, order_index, code')
    .eq('topic_id', eligible.topic_id)
    .eq('is_current', true)
    .order('order_index', { ascending: true });
  const outcomes = outcomeRows || [];
  const outcomeIds = outcomes.map((o: { id: number }) => o.id);
  const { data: weeksData } = outcomeIds.length
    ? await supabase.from('outcome_weeks').select('outcome_id, start_week').in('outcome_id', outcomeIds)
    : { data: [] as { outcome_id: number; start_week: number }[] };
  const weekByOutcomeId = new Map<number, number>();
  (weeksData || []).forEach((w: { outcome_id: number; start_week: number }) => weekByOutcomeId.set(w.outcome_id, w.start_week));
  const sortedOutcomes = sortOutcomesByWeek(
    outcomes.map((o: { id: number; description: string; order_index: number | null; code: string | null }) => ({
      ...o,
      startWeek: weekByOutcomeId.get(o.id) ?? null,
    }))
  );
  const outcomesText = sortedOutcomes.length
    ? sortedOutcomes.map((o: { code: string | null; description: string }) => `${o.code}) ${o.description}`).join('\n')
    : 'Bu konu için tanımlı kazanım bulunamadı.';

  const promptDir = path.join(process.cwd(), 'app', 'prompt');
  const template = await readFile(path.join(promptDir, '07-topic-highlights.md'), 'utf8');

  const prompt = template
    .replaceAll('{grade}', gradeRow.name)
    .replaceAll('{lesson}', lessonRow.name)
    .replaceAll('{unit}', unitRow.title)
    .replaceAll('{topic}', topicRow.title)
    .replaceAll('{outcomes listesi, kod + metin}', outcomesText)
    .replaceAll('{topic_content}', topicContentText || '(henüz ders notu yok)');

  let raw: unknown;
  try {
    raw = await generateTopicContentJson(prompt);
  } catch (e) {
    return { generated: false, reason: `Gemini çağrısı başarısız: ${e instanceof Error ? e.message : String(e)}` };
  }

  const highlights = parseHighlights(raw);
  if (!highlights) return { generated: false, reason: 'Gemini çıktısı beklenen JSON şemasına uymadı' };

  const clean = cleanHighlights(eligible.topic_content_id, highlights);
  if (!clean.length) return { generated: false, reason: 'Gemini geçerli bir anahtar kavram üretmedi' };

  const saveError = await replaceHighlights(supabase, eligible.topic_content_id, clean);
  if (saveError) return { generated: false, reason: `Kaydedilemedi: ${saveError.message}` };

  return { generated: true, topicId: eligible.topic_id };
}
