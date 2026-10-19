// Konu sayfasındaki kazanımların haftaları (outcome_weeks). Hem sunucu hem istemci kullanır.
import type { SupabaseClient } from '@supabase/supabase-js';

// Kazanımın işleneceği öğretim haftası aralığı (start_week–end_week).
export type WeekRange = { start: number; end: number };

// Konunun güncel kazanımlarının haftaları (kazanım kimliğine göre).
export async function fetchTopicOutcomeSchedule(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  topicId: number
): Promise<Record<number, WeekRange[]>> {
  const { data, error } = await supabase
    .from('outcomes')
    .select('id, outcome_weeks(start_week, end_week)')
    .eq('topic_id', topicId)
    .eq('is_current', true);
  if (error) throw error;
  const result: Record<number, WeekRange[]> = {};
  for (const row of (data as unknown as { id: number; outcome_weeks: { start_week: number; end_week: number }[] }[] | null) ?? []) {
    result[row.id] = row.outcome_weeks.map((w) => ({ start: w.start_week, end: w.end_week }));
  }
  return result;
}

// Birden çok konunun haftası tek sorguda (İlerlemem ders sayfası). Konunun tüm güncel kazanımlarının
// en erken başlangıcı–en geç bitişi. Haftası olmayan konu null: etiket gösterilmez, tahmin edilmez.
export async function fetchTopicWeekSpans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  topicIds: number[]
): Promise<Record<number, WeekRange | null>> {
  const result: Record<number, WeekRange | null> = Object.fromEntries(topicIds.map((id) => [id, null]));
  if (topicIds.length === 0) return result;
  const { data, error } = await supabase
    .from('outcomes')
    .select('topic_id, outcome_weeks(start_week, end_week)')
    .in('topic_id', topicIds)
    .eq('is_current', true);
  if (error) throw error;
  for (const row of (data as unknown as { topic_id: number; outcome_weeks: { start_week: number; end_week: number }[] }[] | null) ?? []) {
    for (const w of row.outcome_weeks) {
      const current = result[row.topic_id];
      result[row.topic_id] = current
        ? { start: Math.min(current.start, w.start_week), end: Math.max(current.end, w.end_week) }
        : { start: w.start_week, end: w.end_week };
    }
  }
  return result;
}

// "3. hafta" ya da "1–3. hafta". Birleşik aralıklar için kullanılır.
export function weekLabel(range: WeekRange): string {
  return range.start === range.end ? `${range.start}. hafta` : `${range.start}–${range.end}. hafta`;
}

// Birden çok konunun haftalarını birleştirir (ünite etiketi). Hiçbirinde hafta yoksa null.
export function mergeWeekSpans(spans: (WeekRange | null | undefined)[]): WeekRange | null {
  const known = spans.filter((s): s is WeekRange => !!s);
  if (known.length === 0) return null;
  return { start: Math.min(...known.map((s) => s.start)), end: Math.max(...known.map((s) => s.end)) };
}
