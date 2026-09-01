'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../src/context/AuthContext';
import { PanelShell } from '../src/components/PanelShell';
import { AuthPrompt } from '../src/components/AuthPrompt';

interface Progress {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
}

export default function ProgressPage() {
  const { user, loading: authLoading, supabase } = useAuth();
  const [fullName, setFullName] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setIsFetching(true);
      try {
        const [{ data: statsData }, { data: profile }] = await Promise.all([
          supabase.from('user_question_stats').select('correct_attempts, wrong_attempts').eq('user_id', user!.id),
          supabase.from('profiles').select('full_name').eq('id', user!.id).maybeSingle(),
        ]);
        if (cancelled) return;

        const stats = (statsData as { correct_attempts: number | null; wrong_attempts: number | null }[] | null) || [];
        const totalCorrect = stats.reduce((sum, s) => sum + (s.correct_attempts || 0), 0);
        const totalWrong = stats.reduce((sum, s) => sum + (s.wrong_attempts || 0), 0);
        const total = totalCorrect + totalWrong;

        setProgress({
          totalQuestions: total,
          correctAnswers: totalCorrect,
          wrongAnswers: totalWrong,
          accuracy: total > 0 ? Math.round((totalCorrect / total) * 100) : 0,
        });
        setFullName((profile as { full_name: string | null } | null)?.full_name ?? null);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  const isLoading = authLoading || (!!user && isFetching);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PanelShell
      activeItem="stats"
      isAuthenticated={!!user}
      userName={fullName || 'Öğrenci'}
      title="İstatistik"
      subtitle="Bugüne kadar çözdüğün tüm soruların özeti."
    >
      <div className="max-w-4xl mx-auto">
        {!user || !progress ? (
          <AuthPrompt message="İstatistiklerini görmek için giriş yap." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="rounded-2xl bg-surface-elevated border border-default p-4 sm:p-6">
              <p className="text-muted-foreground text-sm">Toplam Soru</p>
              <p className="text-3xl sm:text-4xl font-bold text-default mt-1">{progress.totalQuestions}</p>
            </div>

            <div className="rounded-2xl bg-surface-elevated border border-default p-4 sm:p-6">
              <p className="text-muted-foreground text-sm">Doğru</p>
              <p className="text-3xl sm:text-4xl font-bold text-emerald-400 mt-1">{progress.correctAnswers}</p>
            </div>

            <div className="rounded-2xl bg-surface-elevated border border-default p-4 sm:p-6">
              <p className="text-muted-foreground text-sm">Yanlış</p>
              <p className="text-3xl sm:text-4xl font-bold text-rose-400 mt-1">{progress.wrongAnswers}</p>
            </div>

            <div className="rounded-2xl bg-surface-elevated border border-default p-4 sm:p-6 md:col-span-3">
              <p className="text-muted-foreground text-sm">Başarı Oranı</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
                    style={{ width: `${progress.accuracy}%` }}
                  />
                </div>
                <p className="text-xl sm:text-2xl font-bold text-default">%{progress.accuracy}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
