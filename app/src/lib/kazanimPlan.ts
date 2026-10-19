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
