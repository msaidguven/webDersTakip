// app/src/lib/soruBankasiStatus.ts
// Soru bankası sayfasındaki "Teste Başla"/"Teste Devam Et" kartının verisi — bu konuda/
// ünitede kullanıcının o ana kadar çözdüğü/doğru/yanlış toplamı + yarım kalmış bir oturum
// varsa onun ilerlemesi. Sadece giriş yapmış kullanıcı için anlamlı (misafirde istatistik
// yok) — kullanıcının 2026-09-05 isteği: "toplam soru çözülen doğru yanlış ve şimdi açılan
// testin kaç sorudan oluşacağı bilgisini verelim, yarım kalan oturum varsa devam et diyelim".
// Var olan iki mekanizmayı (findResumableSession, user_question_stats) birleştiriyor —
// yeni bir tracking sistemi icat etmiyoruz.
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_QUESTIONS_PER_TEST } from './quizQuestions';
import { findResumableSession } from './quizResume';

export interface SoruBankasiTestStatus {
  loggedIn: boolean;
  poolSize: number;
  testSize: number;
  solved: number;
  correct: number;
  wrong: number;
  resumable: { sessionId: number; total: number; answeredCount: number; correctCount: number; wrongCount: number } | null;
}

export async function getSoruBankasiTestStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string | null,
  { unitId, topicId, questionIds }: { unitId: number; topicId: number | null; questionIds: number[] }
): Promise<SoruBankasiTestStatus> {
  const poolSize = questionIds.length;
  const testSize = Math.min(poolSize, MAX_QUESTIONS_PER_TEST);

  if (!userId || poolSize === 0) {
    return { loggedIn: !!userId, poolSize, testSize, solved: 0, correct: 0, wrong: 0, resumable: null };
  }

  const [{ data: statsRows }, resumable] = await Promise.all([
    supabase
      .from('user_question_stats')
      .select('last_answer_correct')
      .eq('user_id', userId)
      .in('question_id', questionIds)
      .gt('total_attempts', 0),
    findResumableSession(supabase, userId, unitId, topicId),
  ]);

  const rows = (statsRows as { last_answer_correct: boolean }[] | null) || [];
  const correct = rows.filter((r) => r.last_answer_correct).length;

  return {
    loggedIn: true,
    poolSize,
    testSize,
    solved: rows.length,
    correct,
    wrong: rows.length - correct,
    resumable: resumable
      ? {
          sessionId: resumable.sessionId,
          total: resumable.questions.length,
          answeredCount: resumable.answers.length,
          correctCount: resumable.answers.filter((a) => a.isCorrect).length,
          wrongCount: resumable.answers.filter((a) => !a.isCorrect).length,
        }
      : null,
  };
}
