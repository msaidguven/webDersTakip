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

  if (!userId || poolSize === 0) {
    const testSize = Math.min(poolSize, MAX_QUESTIONS_PER_TEST);
    return { loggedIn: !!userId, poolSize, testSize, solved: 0, correct: 0, wrong: 0, resumable: null };
  }

  // total_attempts>0 filtresi KALDIRILDI: solved/correct/wrong için hâlâ sadece
  // denenmiş satırlar sayılıyor (aşağıda), ama testSize hesabı için hiç denenmemiş
  // sorular da (total_attempts=0 ya da hiç satırı yok) gerekiyor — bkz. altındaki not.
  const [{ data: statsRows }, resumableSession] = await Promise.all([
    supabase
      .from('user_question_stats')
      .select('question_id, total_attempts, last_answer_correct, next_review_at')
      .eq('user_id', userId)
      .in('question_id', questionIds),
    findResumableSession(supabase, userId, unitId, topicId),
  ]);

  const rows =
    (statsRows as { question_id: number; total_attempts: number; last_answer_correct: boolean; next_review_at: string | null }[] | null) || [];
  const attemptedRows = rows.filter((r) => r.total_attempts > 0);
  const correct = attemptedRows.filter((r) => r.last_answer_correct).length;

  // "X Soru Çöz" butonu, selectPersonalizedQuestionIds'in GERÇEKTE seçeceği soru sayısını
  // göstersin diye — AYNI ÜÇ MOD burada da tekrarlanıyor (bkz. o fonksiyondaki güncel
  // yorum, 2026-09-12): havuzda hiç çözülmemiş soru varsa SADECE onlar sayılır (SRS
  // tekrar sorularıyla karıştırılmaz — kullanıcının "8 soru, 5 çözülmüş, 4 soru çöz ne
  // alaka" tepkisi), yoksa tekrar zamanı gelmiş sorular, o da yoksa (her şey çözülmüş,
  // hiçbiri vakti gelmemiş) en yakın tekrar sırasındakiler.
  const statsByQuestion = new Map(rows.map((r) => [r.question_id, r]));
  const now = Date.now();
  let unseenCount = 0;
  let dueCount = 0;
  for (const id of questionIds) {
    const stat = statsByQuestion.get(id);
    if (!stat || !stat.total_attempts) {
      unseenCount += 1;
      continue;
    }
    if (stat.next_review_at && new Date(stat.next_review_at).getTime() <= now) dueCount += 1;
  }
  let eligibleCount = unseenCount > 0 ? unseenCount : dueCount;
  if (eligibleCount === 0 && attemptedRows.length > 0) eligibleCount = attemptedRows.length;
  const testSize = Math.min(eligibleCount, MAX_QUESTIONS_PER_TEST);

  // Bir oturum "yarım kalmış" görünse de, atanmış sorularının HEPSİ başka bir yoldan (ör.
  // ünite testi — aynı unit_id'yi paylaşıp bu konunun sorularını da havuzuna alıyor, ya da
  // SRS tekrarı) zaten cevaplanmışsa artık işlevsizdir: kullanıcı "her şeyi çözdüm" görürken
  // aynı anda "yarım kalan testin var" görmesi kafa karıştırıcı (kullanıcının 2026-09-06 bug
  // raporu). answeredQuestionIds sadece o an çektiğimiz pool'a ait — resumable'ın sorularından
  // biri pool DIŞINDaysa (nadir, havuz sonradan değiştiyse) temkinli davranıp oturumu
  // hayalet SAYMIYORUZ (yanlışlıkla gerçek bir ilerlemeyi kapatmamak için).
  const answeredQuestionIds = new Set(attemptedRows.map((r) => r.question_id));
  let resumable = resumableSession;
  if (resumable && resumable.questions.every((q) => answeredQuestionIds.has(q.id))) {
    // Service-role client kullanıldığı için finish_test_session RPC'sindeki auth.uid()
    // kontrolü çalışmaz — bunun yerine doğrudan UPDATE (findResumableSession zaten
    // user_id = userId şartıyla getirdiği için sahiplik burada zaten doğrulanmış durumda).
    // Aynı tabloyu güncellediği için mevcut trg_on_test_completed tetikleyicisi de (bkz.
    // auto_complete_web_quiz_session_when_answered.sql) normal şekilde tetiklenir.
    await supabase.from('test_sessions').update({ completed_at: new Date().toISOString() }).eq('id', resumable.sessionId).is('completed_at', null);
    resumable = null;
  }

  return {
    loggedIn: true,
    poolSize,
    testSize,
    solved: attemptedRows.length,
    correct,
    wrong: attemptedRows.length - correct,
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

export interface TopicStatEntry {
  topicId: number;
  poolSize: number;
  solved: number;
  correct: number;
  wrong: number;
}

// Ünite sayfasındaki "Konu Bazlı Analizler" bölümü için — o ünitedeki HER konunun
// soru/çözülen/doğru/yanlış sayısını TEK seferde döner (konu başına ayrı sorgu yerine;
// bkz. kullanıcının "sıralı sorgu yerine tek istek" tercihi). getSoruBankasiTestStatus'tan
// farklı olarak resumable/testSize taşımaz — bu sadece bir özet tablo, test başlatma
// mantığı hâlâ TestStatusCard/getSoruBankasiTestStatus'ta.
export async function getUnitTopicStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string | null,
  topicIds: number[]
): Promise<TopicStatEntry[]> {
  if (!topicIds.length) return [];

  const { data: questionRows } = await supabase.from('questions').select('id, topic_id').in('topic_id', topicIds).eq('is_active', true);
  const rows = (questionRows as { id: number; topic_id: number }[] | null) || [];

  const questionIdsByTopic = new Map<number, number[]>();
  const topicIdByQuestionId = new Map<number, number>();
  for (const row of rows) {
    const list = questionIdsByTopic.get(row.topic_id) || [];
    list.push(row.id);
    questionIdsByTopic.set(row.topic_id, list);
    topicIdByQuestionId.set(row.id, row.topic_id);
  }

  const statsByTopic = new Map<number, { solved: number; correct: number }>();
  if (userId && rows.length) {
    const { data: statsRows } = await supabase
      .from('user_question_stats')
      .select('question_id, last_answer_correct')
      .eq('user_id', userId)
      .in('question_id', rows.map((r) => r.id))
      .gt('total_attempts', 0);

    for (const stat of (statsRows as { question_id: number; last_answer_correct: boolean }[] | null) || []) {
      const topicId = topicIdByQuestionId.get(stat.question_id);
      if (topicId == null) continue;
      const entry = statsByTopic.get(topicId) || { solved: 0, correct: 0 };
      entry.solved += 1;
      if (stat.last_answer_correct) entry.correct += 1;
      statsByTopic.set(topicId, entry);
    }
  }

  return topicIds.map((topicId) => {
    const poolSize = questionIdsByTopic.get(topicId)?.length ?? 0;
    const { solved, correct } = statsByTopic.get(topicId) || { solved: 0, correct: 0 };
    return { topicId, poolSize, solved, correct, wrong: solved - correct };
  });
}
