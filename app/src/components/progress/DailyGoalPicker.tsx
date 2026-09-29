'use client';

// Günlük hedef seçimi (İlerlemem başlığı, yol haritası 4i). Kayıt set_my_daily_goal RPC'si
// (yalnız 10/20/40, yalnız kendi profili). İyimser güncelleme: seçim hemen görünür, hata
// olursa eski değere döner. Anasayfadaki "Günlük hedef" kartı bir sonraki yüklemede yeni
// hedefi gösterir (student-today önbelleği tazelenir).
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { useMyProfileBasics, type MyProfileBasics } from '@/app/src/hooks/useMyGradeSlug';
import { DAILY_GOAL_OPTIONS, type DailyGoal } from '@/app/src/lib/dashboardStreak';

export function DailyGoalPicker() {
  const { user, supabase } = useAuth();
  const profile = useMyProfileBasics();
  const { mutate } = useSWRConfig();
  const [error, setError] = useState(false);

  if (!user || !profile) return null;
  const profileKey = ['my-profile-basics', user.id];

  const choose = async (goal: DailyGoal) => {
    if (goal === profile.dailyGoal) return;
    setError(false);
    try {
      await mutate(
        profileKey,
        async (current?: MyProfileBasics) => {
          const { error: rpcError } = await supabase.rpc('set_my_daily_goal', { p_goal: goal });
          if (rpcError) throw rpcError;
          return current ? { ...current, dailyGoal: goal } : current;
        },
        {
          optimisticData: (current?: MyProfileBasics) => (current ? { ...current, dailyGoal: goal } : current!),
          rollbackOnError: true,
          revalidate: false,
        }
      );
      void mutate(['student-today', user.id]);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex items-center gap-3">
        <span id="gunluk-hedef-etiket" className="whitespace-nowrap text-sm font-bold text-muted-foreground">
          Günlük hedefin
        </span>
        <div role="group" aria-labelledby="gunluk-hedef-etiket" className="flex gap-1 rounded-2xl bg-surface-elevated p-1">
          {DAILY_GOAL_OPTIONS.map((g) => {
            const active = g === profile.dailyGoal;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={active}
                aria-label={`${g} soru`}
                onClick={() => void choose(g)}
                className={`min-h-10 min-w-12 whitespace-nowrap rounded-xl px-3 text-sm font-extrabold transition-colors ${
                  active ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:text-default'
                }`}
              >
                {g}
                <span className="hidden sm:inline"> soru</span>
              </button>
            );
          })}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
          Hedefin kaydedilemedi, tekrar dener misin?
        </p>
      )}
    </div>
  );
}
