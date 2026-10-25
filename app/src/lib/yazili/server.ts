// Yazılı soruları — admin route'larının ortak sunucu sorguları: konuların kazanımları (promptla aynı
// kazanım anahtarlarıyla) ve konu/kazanım bazında klasik soru sayıları.
import 'server-only';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { attachLearningOutcomeCodes, buildOutcomeKeys, sortOutcomesByWeek } from '@/app/src/lib/outcomeCodes';
import { TYPE_ID } from '@/app/src/lib/parseMixedQuestions';
import type { WeekRange } from '@/app/src/lib/kazanimPlan';
import { normalizeLoCode } from '@/app/src/lib/yazili/common';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

// loCode: öğrenme çıktısı kodu (MAT.6.1.1) — MEB dağılım tablosu bu düzeyde soru sayısı verir.
export type ExamOutcome = { id: number; key: string; loCode: string | null; description: string; weeks: WeekRange[] };

type OutcomeRow = {
  id: number;
  topic_id: number;
  description: string;
  order_index: number | null;
  code: string | null;
  learning_outcome_id: number | null;
  outcome_weeks: { start_week: number; end_week: number }[];
};

// Konu başına güncel kazanımlar, haftaya göre sıralı. key = AI'a verilen ve geri çözülen kod
// (bkz. outcomeCodes.buildOutcomeKeys) — prompt ile kaydetme aynı anahtarı kullanmalı.
export async function loadTopicOutcomes(supabase: Supabase, topicIds: number[]): Promise<Map<number, ExamOutcome[]>> {
  const result = new Map<number, ExamOutcome[]>(topicIds.map((id) => [id, []]));
  if (!topicIds.length) return result;
  const { data, error } = await supabase
    .from('outcomes')
    .select('id, topic_id, description, order_index, code, learning_outcome_id, outcome_weeks(start_week, end_week)')
    .in('topic_id', topicIds)
    .eq('is_current', true);
  if (error) throw error;
  const rows = await attachLearningOutcomeCodes(supabase, (data as unknown as OutcomeRow[] | null) ?? []);

  const byTopic = new Map<number, typeof rows>();
  for (const row of rows) byTopic.set(row.topic_id, [...(byTopic.get(row.topic_id) ?? []), row]);

  for (const [topicId, list] of byTopic) {
    const sorted = sortOutcomesByWeek(
      list.map((o) => ({ ...o, startWeek: o.outcome_weeks.length ? Math.min(...o.outcome_weeks.map((w) => w.start_week)) : null }))
    );
    const keys = buildOutcomeKeys(sorted);
    result.set(
      topicId,
      sorted.map((o) => ({
        id: o.id,
        key: keys.get(o.id) ?? '',
        loCode: o.learningOutcomeCode ? normalizeLoCode(o.learningOutcomeCode) : null,
        description: o.description,
        weeks: o.outcome_weeks.map((w) => ({ start: w.start_week, end: w.end_week })),
      }))
    );
  }
  return result;
}

// Konu başına klasik soru sayısı ve kazanım başına dağılım — yalnız YAYINDAKİ (is_active) sorular, çünkü
// sayfa ve kağıtlar yalnız onları kullanır. Görseli (SVG) bekleyen taslaklar ayrıca svgPending'de.
// answerSvgPending: cevap görseli bekleyen sorular — yalnız bilgi, yayını ve havuzu etkilemez (plan kural 1).
export type ClassicalCounts = { total: number; svgPending: number; answerSvgPending: number; byOutcome: Record<number, number> };

export async function loadClassicalCounts(
  supabase: Supabase,
  topicIds: number[]
): Promise<Map<number, ClassicalCounts>> {
  const result = new Map<number, ClassicalCounts>(topicIds.map((id) => [id, { total: 0, svgPending: 0, answerSvgPending: 0, byOutcome: {} }]));
  if (!topicIds.length) return result;
  const { data, error } = await supabase
    .from('questions')
    .select('topic_id, is_active, svg_prompt, svg_content, question_outcomes(outcome_id), question_classical(answer_svg_prompt, answer_svg_content)')
    .in('topic_id', topicIds)
    .eq('question_type_id', TYPE_ID.classical);
  if (error) throw error;
  type Row = {
    topic_id: number; is_active: boolean; svg_prompt: string | null; svg_content: string | null; question_outcomes: { outcome_id: number }[];
    question_classical: { answer_svg_prompt: string | null; answer_svg_content: string | null } | null;
  };
  for (const q of (data as unknown as Row[] | null) ?? []) {
    const entry = result.get(q.topic_id);
    if (!entry) continue;
    if (q.svg_prompt && !q.svg_content) entry.svgPending += 1;
    if (q.question_classical?.answer_svg_prompt && !q.question_classical.answer_svg_content) entry.answerSvgPending += 1;
    if (!q.is_active) continue;
    entry.total += 1;
    for (const { outcome_id } of q.question_outcomes) entry.byOutcome[outcome_id] = (entry.byOutcome[outcome_id] ?? 0) + 1;
  }
  return result;
}

// Konu başına öğrenme çıktısı kodları (topic_learning_outcomes) — MEB tablosundaki kodlarla eşleşir.
export async function loadTopicLoCodes(supabase: Supabase, topicIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>(topicIds.map((id) => [id, []]));
  if (!topicIds.length) return result;
  const { data, error } = await supabase.from('topic_learning_outcomes').select('topic_id, code, order_no').in('topic_id', topicIds).order('order_no');
  if (error) throw error;
  for (const r of (data as { topic_id: number; code: string | null }[] | null) ?? []) {
    const code = r.code ? normalizeLoCode(r.code) : null;
    if (code && !result.get(r.topic_id)!.includes(code)) result.get(r.topic_id)!.push(code);
  }
  return result;
}

// Konunun öğrenme çıktısı başına klasik soru sayısı. Kazanımın kodu yoksa konunun tek öğrenme çıktısına yazılır.
export function classicalByLo(
  topicId: number,
  outcomesByTopic: Map<number, ExamOutcome[]>,
  countsByTopic: Map<number, ClassicalCounts>,
  loByTopic: Map<number, string[]>
): Record<string, number> {
  const out: Record<string, number> = {};
  const codes = loByTopic.get(topicId) ?? [];
  for (const o of outcomesByTopic.get(topicId) ?? []) {
    const code = o.loCode ?? (codes.length === 1 ? codes[0] : null);
    const n = countsByTopic.get(topicId)?.byOutcome[o.id] ?? 0;
    if (code && n) out[code] = (out[code] ?? 0) + n;
  }
  return out;
}

// Yazılı sayfaları az (sınıf × ders × 4) ve istek gelince üretiliyor: soru/kapsam değişince hepsini
// geçersiz kılmak, hangi yazılının etkilendiğini çözmekten ucuz ve hatasız.
export function revalidateYaziliPages(): void {
  try {
    revalidatePath('/yazili-sorulari', 'layout');
    // Anasayfadaki "Yaklaşan yazılılar" kartı da yayındaki yazılılardan beslenir.
    revalidatePath('/');
  } catch (error) {
    console.error('[revalidateYaziliPages] revalidate başarısız:', error);
  }
}
