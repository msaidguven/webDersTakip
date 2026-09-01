import type { SupabaseClient } from '@supabase/supabase-js';
import { currentWeekStartDateString } from './dashboardDate';

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalQuestions: number;
  isMe: boolean;
}

type LeaderboardRow = { rank: number; display_name: string; total_questions: number; is_me: boolean };

// get_weekly_leaderboard (bkz. supabase/migrations/add_weekly_leaderboard_rpc.sql) SECURITY
// DEFINER bir RPC — çağıranın kendi grade_id'sini kendisi bulur, başka kullanıcıların
// user_id/full_name/email'ini asla döndürmez, sadece sıra + takma ad (username, yoksa
// "Öğrenci") + soru sayısı. Sonuç boşsa ya çağıranın grade_id'si yok ya da bu hafta o
// sınıfta kimse (kendisi dahil) hiç soru çözmemiş demektir.
export async function getWeeklyLeaderboard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
    p_week_start: currentWeekStartDateString(),
  });

  if (error) {
    console.error('get_weekly_leaderboard error:', error.message);
    return [];
  }

  return ((data as LeaderboardRow[] | null) || []).map((r) => ({
    rank: r.rank,
    displayName: r.display_name,
    totalQuestions: r.total_questions,
    isMe: r.is_me,
  }));
}
