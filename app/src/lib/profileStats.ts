import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentStreak } from './dashboardStreak';
import { fetchAllRows } from './fetchAllRows';

export interface ProfileStats {
  totalTests: number;
  totalQuestions: number;
  correctAnswers: number;
  averageScore: number;
  accuracy: number;
  mastery: number;
  streakDays: number;
}

type SessionRow = { id: number; completed_at: string | null };
type AnswerRow = { question_id: number; is_correct: boolean; test_session_id: number };

// Profil sayfasının "Genel Performans" bloğu daha önce sabit bir UserStats nesnesi (15 test,
// 230 soru, ...) gösteriyordu — her kullanıcıya aynı sahte sayılar. Burada tamamen
// test_sessions/test_session_answers'tan (ve mastery için user_question_stats'tan) hesaplanır.
// Kapsam (2026-10-20'den beri konu bazlı) burada değil, profil sayfasında konu verisinden (useTopicMastery);
// kullanıcı henüz hiç test bitirmediyse gerçek değer olan 0'lar döner, uydurma bir sayı değil.
export async function getProfileStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<ProfileStats> {
  // Aktif bir öğrencinin cevap (ve zamanla oturum) sayısı 1000'i geçer — sayfa sayfa okunur.
  const [sessions, answers, streakDays] = await Promise.all([
    fetchAllRows<SessionRow>((from, to) =>
      supabase.from('test_sessions').select('id, completed_at').eq('user_id', userId).order('id').range(from, to)
    ),
    fetchAllRows<AnswerRow>((from, to) =>
      supabase.from('test_session_answers').select('question_id, is_correct, test_session_id').eq('user_id', userId).order('id').range(from, to)
    ),
    getCurrentStreak(supabase, userId),
  ]);
  const completedSessions = sessions.filter((s) => s.completed_at);

  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((a) => a.is_correct).length;
  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const answerAggBySession = new Map<number, { correct: number; total: number }>();
  for (const a of answers) {
    const agg = answerAggBySession.get(a.test_session_id) || { correct: 0, total: 0 };
    agg.total += 1;
    if (a.is_correct) agg.correct += 1;
    answerAggBySession.set(a.test_session_id, agg);
  }
  const perTestScores = completedSessions
    .map((s) => answerAggBySession.get(s.id))
    .filter((agg): agg is { correct: number; total: number } => !!agg && agg.total > 0)
    .map((agg) => (agg.correct / agg.total) * 100);
  const averageScore = perTestScores.length > 0 ? Math.round(perTestScores.reduce((a, b) => a + b, 0) / perTestScores.length) : 0;

  // Ustalık: cevaplanan farklı sorulardan user_question_stats.is_mastered=true olanların oranı.
  const distinctQuestionIds = [...new Set(answers.map((a) => a.question_id))];
  let mastery = 0;
  if (distinctQuestionIds.length > 0) {
    const { data: masteryRows } = await supabase
      .from('user_question_stats')
      .select('is_mastered')
      .eq('user_id', userId)
      .in('question_id', distinctQuestionIds);
    const masteredCount = (masteryRows as { is_mastered: boolean }[] | null)?.filter((r) => r.is_mastered).length ?? 0;
    mastery = Math.round((masteredCount / distinctQuestionIds.length) * 100);
  }

  return {
    totalTests: completedSessions.length,
    totalQuestions,
    correctAnswers,
    averageScore,
    accuracy,
    mastery,
    streakDays,
  };
}
