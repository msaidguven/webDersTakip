import type { SupabaseClient } from '@supabase/supabase-js';
import { toDateString, todayDateString } from './dashboardDate';

// Sabit bir günlük hedef: DB'de kullanıcı bazlı bir dailyGoal alanı yok (bkz.
// docs/site-iyilestirme-plani.md madde 3 tartışması), bu yüzden herkes için tek bir hedef
// kullanılıyor. İleride kişiselleştirilecekse profiles'a bir kolon eklenip buradan okunabilir.
export const DAILY_GOAL_QUESTIONS = 20;

const STREAK_LOOKBACK_DAYS = 60;

export async function getTodayQuestionCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from('user_time_based_stats')
    .select('total_questions')
    .eq('user_id', userId)
    .eq('period_type', 'daily')
    .eq('period_date', todayDateString())
    .maybeSingle();

  return (data as { total_questions: number } | null)?.total_questions ?? 0;
}

// Duolingo tarzı: bugün henüz soru çözülmemişse streak hemen sıfırlanmaz — dünden itibaren
// ardışık aktif günler sayılır, streak "bugün bitene kadar" hayatta kalır ve kullanıcıyı bugün
// de çözmeye iter. user_time_based_stats zaten her test bitişinde
// update_user_time_based_stats_on_test_complete RPC'siyle güncellendiği için ayrı bir streak
// tablosu/migration'a gerek yok, geçmiş günlerden türetiliyor.
export async function getCurrentStreak(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - STREAK_LOOKBACK_DAYS);

  const { data } = await supabase
    .from('user_time_based_stats')
    .select('period_date')
    .eq('user_id', userId)
    .eq('period_type', 'daily')
    .gt('total_questions', 0)
    .gte('period_date', toDateString(since));

  const activeDates = new Set(((data as { period_date: string }[] | null) || []).map((r) => r.period_date));
  if (activeDates.size === 0) return 0;

  const cursor = new Date();
  if (!activeDates.has(toDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDates.has(toDateString(cursor))) return 0;
  }

  let streak = 0;
  while (activeDates.has(toDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
