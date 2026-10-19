// İlerlemem "Aylık çizelge" verisi (bkz. supabase/migrations/get_my_monthly_subject_activity.sql).
// Sunucu gün × ders satırları döner; burada ayın her günü için tablo satırı kurulur (boş günler de
// dahil — kağıt çizelgedeki gibi). Doğru/yanlış/toplam hepsi buradan türetilir.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface MonthlyActivityRow {
  day: string; // YYYY-MM-DD (Europe/Istanbul)
  lesson_id: number;
  answered: number;
  correct: number;
}

export interface SubjectCell {
  correct: number;
  wrong: number;
}

export interface MonthlyDay {
  day: string;
  subjects: Record<number, SubjectCell>;
  total: number;
}

export async function fetchMonthlyActivity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  month: string // YYYY-MM
): Promise<MonthlyActivityRow[]> {
  const { data, error } = await supabase.rpc('get_my_monthly_subject_activity', { p_month: `${month}-01` });
  if (error) throw error;
  return (data as MonthlyActivityRow[] | null) ?? [];
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Ay gezintisi: UTC üzerinde hesaplanır, tarayıcı saat dilimi kaydırmaz.
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

// Eylül'den haziran'a kadar, içinde bulunulan okul yılının ayları (YYYY-MM).
export function schoolYearMonths(today: string): string[] {
  const [y, m] = today.split('-').map(Number);
  const startYear = m >= 9 ? y : y - 1;
  return Array.from({ length: 10 }, (_, i) => shiftMonth(`${startYear}-09`, i));
}

export interface MonthSummary {
  answered: number;
  correct: number;
  wrong: number;
  /** null: ayda hiç soru çözülmemiş. */
  accuracy: number | null;
  activeDays: number;
}

export function summarizeMonth(rows: MonthlyActivityRow[]): MonthSummary {
  let answered = 0;
  let correct = 0;
  const days = new Set<string>();
  for (const r of rows) {
    answered += r.answered;
    correct += r.correct;
    days.add(r.day);
  }
  return {
    answered,
    correct,
    wrong: answered - correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
    activeDays: days.size,
  };
}

export function buildMonthDays(rows: MonthlyActivityRow[], month: string): MonthlyDay[] {
  const byDay = new Map<string, MonthlyDay>();
  for (let d = 1; d <= daysInMonth(month); d++) {
    const day = `${month}-${String(d).padStart(2, '0')}`;
    byDay.set(day, { day, subjects: {}, total: 0 });
  }

  for (const r of rows) {
    const entry = byDay.get(r.day);
    if (!entry) continue;
    entry.subjects[r.lesson_id] = { correct: r.correct, wrong: r.answered - r.correct };
    entry.total += r.answered;
  }

  return [...byDay.values()];
}
