import type { SupabaseClient } from '@supabase/supabase-js';
import { Stat } from '@/app/src/models/types';
import { todayDateString } from './dashboardDate';

type DailyStatsRow = { total_questions: number; correct_answers: number; total_duration_seconds: number };

// Stats satırı "bugün" özetidir: user_time_based_stats'ın period_type='daily' satırı
// update_user_time_based_stats_on_test_complete RPC'siyle her test bitişinde güncelleniyor.
// Kullanıcı bugün hiç test çözmemişse satır hiç yok — bu durumda sıfırlar gösterilir (bu da
// doğru: bugün gerçekten sıfır soru çözülmüş demektir).
export async function getTodayStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  dueSrsCount: number
): Promise<Stat[]> {
  const { data: dailyRow } = await supabase
    .from('user_time_based_stats')
    .select('total_questions, correct_answers, total_duration_seconds')
    .eq('user_id', userId)
    .eq('period_type', 'daily')
    .eq('period_date', todayDateString())
    .maybeSingle();

  const daily = dailyRow as DailyStatsRow | null;
  const totalQuestions = daily?.total_questions ?? 0;
  const correctAnswers = daily?.correct_answers ?? 0;
  const minutes = Math.round((daily?.total_duration_seconds ?? 0) / 60);
  const successRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  return [
    { id: 'correct-today', icon: 'check-circle', iconColor: 'purple', value: correctAnswers, label: 'Doğru Cevap' },
    { id: 'minutes-today', icon: 'clock', iconColor: 'pink', value: minutes, label: 'Dakika' },
    { id: 'success-rate-today', icon: 'trophy', iconColor: 'teal', value: `${successRate}%`, label: 'Başarı Oranı' },
    { id: 'srs-due-count', icon: 'redo', iconColor: 'orange', value: dueSrsCount, label: 'Tekrar Gerekli' },
  ];
}
