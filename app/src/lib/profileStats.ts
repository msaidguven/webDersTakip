import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentStreak } from './dashboardStreak';

export interface ProfileStats {
  totalTests: number;
  totalQuestions: number;
  correctAnswers: number;
  averageScore: number;
  accuracy: number;
  coverage: number;
  mastery: number;
  streakDays: number;
}

type SessionRow = { id: number; unit_id: number | null; lesson_id: number | null; grade_id: number | null; completed_at: string | null };
type AnswerRow = { question_id: number; is_correct: boolean; test_session_id: number };

// Profil sayfasının "Genel Performans" bloğu daha önce sabit bir UserStats nesnesi (15 test,
// 230 soru, ...) gösteriyordu — her kullanıcıya aynı sahte sayılar. Burada tamamen
// test_sessions/test_session_answers'tan (ve mastery için user_question_stats'tan) hesaplanır;
// kullanıcı henüz hiç test bitirmediyse gerçek değer olan 0'lar döner, uydurma bir sayı değil.
export async function getProfileStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<ProfileStats> {
  const [{ data: sessionRows }, { data: answerRows }, streakDays] = await Promise.all([
    supabase.from('test_sessions').select('id, unit_id, lesson_id, grade_id, completed_at').eq('user_id', userId),
    supabase.from('test_session_answers').select('question_id, is_correct, test_session_id').eq('user_id', userId),
    getCurrentStreak(supabase, userId),
  ]);

  const sessions = (sessionRows as SessionRow[] | null) || [];
  const answers = (answerRows as AnswerRow[] | null) || [];
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

  // Kapsam: denenen derslerdeki (lesson_id+grade_id) toplam aktif ünite sayısına kıyasla
  // "bitirilmiş" sayılan ünite sayısı. Bir ünite, o ünitedeki sorularının en az %80'i en az
  // bir kez çözülmüşse bitirilmiş sayılır (kullanıcı kararı, 2026-09-02) — tek soru çözmek
  // üniteyi kapsanmış saymaz.
  const UNIT_FINISH_RATIO = 0.8;
  const touchedUnitIds = new Set<number>();
  const contextPairs = new Map<string, { lessonId: number; gradeId: number }>();
  const sessionUnitById = new Map<number, number>();
  for (const s of sessions) {
    if (s.unit_id != null) {
      touchedUnitIds.add(s.unit_id);
      sessionUnitById.set(s.id, s.unit_id);
    }
    if (s.lesson_id != null && s.grade_id != null) {
      contextPairs.set(`${s.lesson_id}:${s.grade_id}`, { lessonId: s.lesson_id, gradeId: s.grade_id });
    }
  }
  let coverage = 0;
  if (contextPairs.size > 0) {
    const orFilter = [...contextPairs.values()].map((p) => `and(lesson_id.eq.${p.lessonId},grade_id.eq.${p.gradeId})`).join(',');
    const { data: unitRows } = await supabase.from('units').select('id').eq('is_active', true).or(orFilter);
    const totalUnits = (unitRows as { id: number }[] | null)?.length ?? 0;

    let finishedUnitCount = 0;
    if (touchedUnitIds.size > 0) {
      const answeredQuestionsByUnit = new Map<number, Set<number>>();
      for (const a of answers) {
        const unitId = sessionUnitById.get(a.test_session_id);
        if (unitId == null) continue;
        const set = answeredQuestionsByUnit.get(unitId) || new Set<number>();
        set.add(a.question_id);
        answeredQuestionsByUnit.set(unitId, set);
      }

      const { data: topicRows } = await supabase
        .from('topics')
        .select('id, unit_id')
        .eq('is_active', true)
        .in('unit_id', [...touchedUnitIds]);
      const unitIdByTopicId = new Map<number, number>();
      for (const t of (topicRows as { id: number; unit_id: number }[] | null) || []) {
        unitIdByTopicId.set(t.id, t.unit_id);
      }

      const totalQuestionsByUnit = new Map<number, number>();
      if (unitIdByTopicId.size > 0) {
        const { data: questionRows } = await supabase
          .from('questions')
          .select('topic_id')
          .in('topic_id', [...unitIdByTopicId.keys()])
          .eq('is_active', true);
        for (const q of (questionRows as { topic_id: number | null }[] | null) || []) {
          if (q.topic_id == null) continue;
          const unitId = unitIdByTopicId.get(q.topic_id);
          if (unitId == null) continue;
          totalQuestionsByUnit.set(unitId, (totalQuestionsByUnit.get(unitId) || 0) + 1);
        }
      }

      for (const unitId of touchedUnitIds) {
        const totalUnitQuestions = totalQuestionsByUnit.get(unitId) || 0;
        if (totalUnitQuestions === 0) continue;
        const answeredCount = answeredQuestionsByUnit.get(unitId)?.size || 0;
        if (answeredCount / totalUnitQuestions >= UNIT_FINISH_RATIO) finishedUnitCount += 1;
      }
    }

    coverage = totalUnits > 0 ? Math.min(100, Math.round((finishedUnitCount / totalUnits) * 100)) : 0;
  }

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
    coverage,
    mastery,
    streakDays,
  };
}
