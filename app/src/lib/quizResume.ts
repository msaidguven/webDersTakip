import type { SupabaseClient } from '@supabase/supabase-js';
import { getQuestionsByIds, type QuizQuestion } from './quizQuestions';

export interface ResumableSession {
  sessionId: number;
  questions: QuizQuestion[];
  answers: { questionId: number; isCorrect: boolean }[];
}

// Kullanıcı bir ünite/konu testini yarım bırakıp sayfayı tekrar açtığında (yenileme, geri
// gelme vb.) sıfırdan yeni bir test_sessions satırı ve yeni rastgele soru seti açmak yerine
// son bitmemiş oturumu bulur ve aynı soru havuzuyla, zaten cevaplananları atlayarak devam
// ettirir. Öncesinde her sayfa yüklemesi ayrı bir oturum açıyordu ve hiçbiri bitmiyordu — bu da
// hem istatistiklerin (SRS, ünite özeti) hiç hesaplanmamasına hem de panelde "hiç aktivite yok"
// görünmesine yol açıyordu.
export async function findResumableSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  unitId: number,
  topicId: number | null
): Promise<ResumableSession | null> {
  let query = supabase
    .from('test_sessions')
    .select('id, question_ids')
    .eq('user_id', userId)
    .eq('unit_id', unitId)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  query = topicId != null ? query.eq('settings->>topic_id', String(topicId)) : query.is('settings->>topic_id', null);

  const { data: sessionRow } = await query.maybeSingle();
  const session = sessionRow as { id: number; question_ids: number[] | null } | null;
  if (!session || !session.question_ids?.length) return null;

  const [{ data: answerRows }, questions] = await Promise.all([
    supabase.from('test_session_answers').select('question_id, is_correct').eq('test_session_id', session.id),
    getQuestionsByIds([...new Set(session.question_ids)]),
  ]);

  if (questions.length === 0) return null;

  const answers = ((answerRows as { question_id: number; is_correct: boolean }[] | null) || []).map((a) => ({
    questionId: a.question_id,
    isCorrect: a.is_correct,
  }));

  return { sessionId: session.id, questions, answers };
}
