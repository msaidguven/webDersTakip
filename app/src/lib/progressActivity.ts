// İlerlemem sayfasının gün bazlı etkinlik verisi (yol haritası 4c/4d, 2026-09-28).
// Tek kaynak: get_my_daily_activity RPC'si (Türkiye günü, sunucuda gruplanmış). Özet, seri ve
// "Son 4 hafta" tablosu saf fonksiyonlarla buradan türetilir — ek sorgu yok.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DailyActivity {
  day: string; // YYYY-MM-DD (Europe/Istanbul)
  answered: number;
  correct: number;
}

export interface ProgressSummary {
  last7: { answered: number; accuracy: number | null };
  prev7: { answered: number; accuracy: number | null };
  totalAnswered: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

const ISTANBUL_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' });

export function istanbulToday(now: Date = new Date()): string {
  return ISTANBUL_DAY.format(now);
}

// Takvim günü aritmetiği UTC üzerinde — yaz saati / tarayıcı saat dilimi kaydırmasın.
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export async function fetchDailyActivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<DailyActivity[]> {
  const { data, error } = await supabase.rpc('get_my_daily_activity');
  if (error) throw error;
  return (data as DailyActivity[] | null) ?? [];
}

function windowTotals(byDay: Map<string, DailyActivity>, endDay: string, length: number) {
  let answered = 0;
  let correct = 0;
  for (let i = 0; i < length; i++) {
    const row = byDay.get(addDays(endDay, -i));
    if (row) {
      answered += row.answered;
      correct += row.correct;
    }
  }
  return { answered, accuracy: answered ? Math.round((correct / answered) * 100) : null };
}

export function summarizeActivity(rows: DailyActivity[], today: string = istanbulToday()): ProgressSummary {
  const byDay = new Map(rows.map((r) => [r.day, r]));

  // Anasayfadaki seriyle aynı kural: bugün henüz çözülmediyse seri dünden sayılır, gün
  // bitene kadar bozulmaz.
  let cursor = byDay.has(today) ? today : addDays(today, -1);
  let currentStreak = 0;
  while (byDay.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  let longestStreak = 0;
  let run = 0;
  let prevDay: string | null = null;
  for (const r of rows) {
    run = prevDay && addDays(prevDay, 1) === r.day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prevDay = r.day;
  }

  return {
    last7: windowTotals(byDay, today, 7),
    prev7: windowTotals(byDay, addDays(today, -7), 7),
    totalAnswered: rows.reduce((sum, r) => sum + r.answered, 0),
    activeDays: rows.length,
    currentStreak,
    longestStreak,
  };
}
