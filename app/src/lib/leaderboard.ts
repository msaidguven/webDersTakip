import type { SupabaseClient } from '@supabase/supabase-js';
import { currentWeekStartDateString } from './dashboardDate';
import { getSeedLeaderboardEntries } from './leaderboardSeed';

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalQuestions: number;
  isMe: boolean;
  // Gerçek öğrenci mi, geçici sahte kayıt mı (leaderboardSeed.ts). SADECE admin arayüzünde
  // "(G)" işareti için (2026-10-02, kullanıcı isteği); öğrenciye gösterilmez.
  isReal: boolean;
}

type LeaderboardRow = { rank: number; display_name: string; total_questions: number; is_me: boolean };

// get_weekly_leaderboard (bkz. supabase/migrations/add_weekly_leaderboard_rpc.sql) SECURITY
// DEFINER bir RPC — çağıranın kendi grade_id'sini kendisi bulur, başka kullanıcıların
// user_id/full_name/email'ini asla döndürmez, sadece sıra + "Ad S." biçiminde isim (bkz.
// format_public_name, 2026-09-26'dan beri anasayfayla aynı) + soru sayısı. Sonuç boşsa ya çağıranın grade_id'si yok ya da bu hafta o
// sınıfta kimse (kendisi dahil) hiç soru çözmemiş demektir.
export async function getWeeklyLeaderboard(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<LeaderboardEntry[]> {
  const weekStart = currentWeekStartDateString();
  const { data, error } = await supabase.rpc('get_weekly_leaderboard', {
    p_week_start: weekStart,
  });

  if (error) {
    console.error('get_weekly_leaderboard error:', error.message);
    return [];
  }

  const real = ((data as LeaderboardRow[] | null) || []).map((r) => ({
    displayName: r.display_name,
    totalQuestions: r.total_questions,
    isMe: r.is_me,
    isReal: true,
  }));

  // GEÇİCİ SEED — bkz. leaderboardSeed.ts üstündeki not. Yeterli gerçek öğrenciye
  // ulaşılınca bu iki satır ve leaderboardSeed.ts dosyası kaldırılacak.
  const seeded = getSeedLeaderboardEntries(weekStart).map((s) => ({ ...s, isMe: false, isReal: false }));
  const merged = [...real, ...seeded].sort((a, b) => b.totalQuestions - a.totalQuestions);

  return merged.map((entry, i) => ({ rank: i + 1, ...entry }));
}

export interface TopStudentEntry {
  rank: number;
  displayName: string;
  totalQuestions: number;
}

// Admin görünümü için gerçek/sahte bilgisi. Herkese açık sayfa HTML'ine KONMAZ (page.tsx
// stripIsReal ile atar); admin tarayıcıda aynı fonksiyonu kendisi çağırıp bu alanı alır.
export type TopStudentEntryWithSource = TopStudentEntry & { isReal: boolean };

export function stripIsReal(entries: TopStudentEntryWithSource[]): TopStudentEntry[] {
  return entries.map(({ rank, displayName, totalQuestions }) => ({ rank, displayName, totalQuestions }));
}

// Anasayfa (herkese açık, ISR) için tüm sınıflardan bu haftanın en çok soru çözen
// öğrencileri — bkz. get_public_weekly_top_students. Anon client ile çağrılır; kişiye
// özel hiçbir şey (isMe vb.) içermez ki sayfa önbelleğe alınabilsin.
export async function getPublicWeeklyTopStudents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  limit = 5
): Promise<TopStudentEntryWithSource[]> {
  const { data, error } = await supabase.rpc('get_public_weekly_top_students', { p_limit: limit });

  if (error) {
    console.error('get_public_weekly_top_students error:', error.message);
    return [];
  }

  const real = ((data as Omit<LeaderboardRow, 'is_me'>[] | null) || []).map((r) => ({
    displayName: r.display_name,
    totalQuestions: r.total_questions,
    isReal: true,
  }));

  // GEÇİCİ SEED — getWeeklyLeaderboard'daki blokla birlikte kaldırılacak.
  const seeded = getSeedLeaderboardEntries(currentWeekStartDateString()).map((s) => ({ ...s, isReal: false }));
  const merged = [...real, ...seeded].sort((a, b) => b.totalQuestions - a.totalQuestions).slice(0, limit);

  return merged.map((entry, i) => ({ rank: i + 1, ...entry }));
}
