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

export type DayState = 'done' | 'missed' | 'future';

export interface WeekRow {
  start: string; // o haftanın pazartesisi
  label: string;
  days: { day: string; state: DayState }[]; // Pazartesi → Pazar
  answered: number;
  accuracy: number | null;
}

const SHORT_MONTH = new Intl.DateTimeFormat('tr-TR', { month: 'short', timeZone: 'UTC' });

function dayParts(day: string): { date: number; month: string } {
  const [y, m, d] = day.split('-').map(Number);
  return { date: d, month: SHORT_MONTH.format(new Date(Date.UTC(y, m - 1, d))) };
}

function weekLabel(start: string, end: string): string {
  const a = dayParts(start);
  const b = dayParts(end);
  return a.month === b.month ? `${a.date}–${b.date} ${b.month}` : `${a.date} ${a.month} – ${b.date} ${b.month}`;
}

// Takvim haftaları (Pazartesi başlangıç), en yenisi önce. Bu hafta yarım: bugünden sonraki
// günler "future" — boş ama ceza değil.
export function lastWeeks(rows: DailyActivity[], count = 4, today: string = istanbulToday()): WeekRow[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const [y, m, d] = today.split('-').map(Number);
  const mondayOffset = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const thisMonday = addDays(today, -mondayOffset);

  return Array.from({ length: count }, (_, w) => {
    const start = addDays(thisMonday, -7 * w);
    let answered = 0;
    let correct = 0;
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      const row = day > today ? undefined : byDay.get(day);
      if (row) {
        answered += row.answered;
        correct += row.correct;
      }
      const state: DayState = day > today ? 'future' : row ? 'done' : 'missed';
      return { day, state };
    });
    return {
      start,
      label: w === 0 ? 'Bu hafta' : weekLabel(start, addDays(start, 6)),
      days,
      answered,
      accuracy: answered ? Math.round((correct / answered) * 100) : null,
    };
  });
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
    currentStreak,
    longestStreak,
  };
}
