'use client';

// Soru bankası listesini kimin gördüğüne göre ayarlar (kullanıcının 2026-09-27 kararı):
//   * misafir (ve Google): tüm sorular, cevap anahtarlı — SEO içeriği değişmez
//   * öğretmen/admin: tüm sorular (sınıfta kullanmak için)
//   * giriş yapmış öğrenci: SADECE testte daha önce çözdüğü sorular + her birinin kaç kez
//     çözüldüğü / doğru / yanlış sayısı. Çözmediği sorular yalnız test ile açılır — böylece
//     listede kayıtsız çözüm ve testten önce cevap anahtarına bakma olmaz.
// Aynı sayfadaki iki bileşen (SoruBankasiBrowseSection başlığı + QuestionBankBoard) aynı
// veriyi kullanır; modül düzeyindeki önbellek tek istekle ikisini de besler.
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export type QuestionStat = {
  question_id: number;
  total_attempts: number;
  correct_attempts: number;
  wrong_attempts: number;
  last_answer_correct: boolean | null;
  last_answer_at: string | null;
  is_mastered: boolean | null;
  next_review_at: string | null;
};

export type QuestionBankViewer =
  | { status: 'guest' | 'loading' | 'staff'; stats: Map<number, QuestionStat> }
  | { status: 'student'; stats: Map<number, QuestionStat> };

// Test kapanınca (TestStatusCard) ya da sekmeye dönülünce istatistik yeniden çekilir.
export const QUESTION_BANK_STATS_REFRESH_EVENT = 'soru-bankasi:stats-refresh';

const EMPTY = new Map<number, QuestionStat>();
const cache = new Map<string, Promise<QuestionBankViewer>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function load(supabase: any, userId: string, questionIds: number[]): Promise<QuestionBankViewer> {
  const key = `${userId}:${questionIds.join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = (async (): Promise<QuestionBankViewer> => {
    const [{ data: profile }, { data: rows, error }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
      questionIds.length
        ? supabase
            .from('user_question_stats')
            .select('question_id, total_attempts, correct_attempts, wrong_attempts, last_answer_correct, last_answer_at, is_mastered, next_review_at')
            .eq('user_id', userId)
            .in('question_id', questionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const role = (profile as { role: string | null } | null)?.role;
    if (role === 'admin' || role === 'teacher') return { status: 'staff', stats: EMPTY };
    // İstatistik okunamazsa öğrenciyi boş listeye mahkûm etme — eski davranışa (tüm liste) dön.
    if (error) return { status: 'staff', stats: EMPTY };
    const stats = new Map<number, QuestionStat>();
    for (const r of (rows as QuestionStat[] | null) || []) {
      if (r.total_attempts > 0) stats.set(r.question_id, r);
    }
    return { status: 'student', stats };
  })();
  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}

export function useQuestionBankViewer(questionIds: number[]): QuestionBankViewer {
  const { user, supabase, loading: authLoading } = useAuth();
  const userId = user?.id;
  const idsKey = questionIds.join(',');
  const [viewer, setViewer] = useState<QuestionBankViewer>({ status: 'guest', stats: EMPTY });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => {
      cache.clear();
      setVersion((v) => v + 1);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener(QUESTION_BANK_STATS_REFRESH_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(QUESTION_BANK_STATS_REFRESH_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- oturum durumu dış kaynaktan (auth) geliyor
      setViewer({ status: 'guest', stats: EMPTY });
      return;
    }
    let cancelled = false;
    setViewer((prev) => (prev.status === 'guest' ? { status: 'loading', stats: EMPTY } : prev));
    load(supabase, userId, idsKey ? idsKey.split(',').map(Number) : [])
      .then((v) => { if (!cancelled) setViewer(v); })
      .catch(() => { if (!cancelled) setViewer({ status: 'staff', stats: EMPTY }); });
    return () => { cancelled = true; };
  }, [authLoading, userId, supabase, idsKey, version]);

  return viewer;
}
