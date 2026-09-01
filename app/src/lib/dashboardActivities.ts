import type { SupabaseClient } from '@supabase/supabase-js';
import { Activity } from '@/app/src/models/types';

type SessionRow = {
  id: number;
  unit_id: number | null;
  lesson_id: number | null;
  completed_at: string;
  question_ids: number[] | null;
};
type AnswerRow = { test_session_id: number; is_correct: boolean; duration_seconds: number | null };

// Panelin "Son Aktiviteler" akışı için tamamlanmış test_sessions kayıtlarını, o oturuma ait
// test_session_answers'tan hesaplanan skor/süre ile birleştirir. Oturumun bir "türü" (test/
// konu/tekrar) DB'de tutulmuyor — QuizClient/start_web_quiz_session bunu ayırt etmiyor — bu
// yüzden hepsi tek tip 'test' olarak gösterilir; sahte bir ayrım uydurmak yerine gerçek veriyle
// sınırlı kalındı.
export async function getRecentActivities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  limit: number = 5
): Promise<Activity[]> {
  const { data: sessionRows } = await supabase
    .from('test_sessions')
    .select('id, unit_id, lesson_id, completed_at, question_ids')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit);

  const sessions = (sessionRows as SessionRow[] | null) || [];
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const unitIds = [...new Set(sessions.map((s) => s.unit_id).filter((id): id is number => id != null))];
  const lessonIds = [...new Set(sessions.map((s) => s.lesson_id).filter((id): id is number => id != null))];

  const [{ data: answerRows }, { data: unitRows }, { data: lessonRows }] = await Promise.all([
    supabase.from('test_session_answers').select('test_session_id, is_correct, duration_seconds').in('test_session_id', sessionIds),
    unitIds.length ? supabase.from('units').select('id, title').in('id', unitIds) : Promise.resolve({ data: [] }),
    lessonIds.length ? supabase.from('lessons').select('id, name').in('id', lessonIds) : Promise.resolve({ data: [] }),
  ]);

  const unitTitleById = new Map(((unitRows as { id: number; title: string }[] | null) || []).map((u) => [u.id, u.title]));
  const lessonNameById = new Map(((lessonRows as { id: number; name: string }[] | null) || []).map((l) => [l.id, l.name]));

  const answersBySession = new Map<number, AnswerRow[]>();
  for (const row of (answerRows as AnswerRow[] | null) || []) {
    const list = answersBySession.get(row.test_session_id) || [];
    list.push(row);
    answersBySession.set(row.test_session_id, list);
  }

  return sessions.map((s) => {
    const answers = answersBySession.get(s.id) || [];
    const questionCount = s.question_ids?.length ?? answers.length;
    const correctCount = answers.filter((a) => a.is_correct).length;
    const score = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
    const durationSeconds = answers.reduce((sum, a) => sum + (a.duration_seconds ?? 0), 0);
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    const title = s.unit_id && unitTitleById.has(s.unit_id)
      ? `Ünite Testi: ${unitTitleById.get(s.unit_id)}`
      : s.lesson_id && lessonNameById.has(s.lesson_id)
        ? `${lessonNameById.get(s.lesson_id)} Testi`
        : 'Test';

    const activity: Activity = {
      id: String(s.id),
      title,
      type: 'test',
      timestamp: new Date(s.completed_at),
      questionCount,
      durationMinutes,
      score,
      icon: 'calculator',
      iconColor: 'purple',
    };
    return activity;
  });
}
