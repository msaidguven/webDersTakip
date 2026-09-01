'use client';

import React from 'react';
import Link from 'next/link';

interface DailyGoalCardProps {
  dailyProgress: number;
  dailyGoal: number;
  streak: number;
  dueSrsCount: number;
}

export function DailyGoalCard({ dailyProgress, dailyGoal, streak, dueSrsCount }: DailyGoalCardProps) {
  const progressPct = dailyGoal > 0 ? Math.min(100, Math.round((dailyProgress / dailyGoal) * 100)) : 0;
  const goalReached = dailyProgress >= dailyGoal;

  const heading = goalReached
    ? 'Bugünkü hedefini tamamladın! 🎉'
    : dueSrsCount > 0
      ? 'Bugünkü görevin: tekrarlarını yap'
      : 'Bugünkü görevin';

  const subtext = goalReached
    ? 'Harika gidiyorsun, serini korumak için yarın da uğra.'
    : dueSrsCount > 0
      ? `${dueSrsCount} soru tekrar zamanı geldi, önce onları çöz.`
      : `${dailyGoal} soru çözerek serini canlı tut.`;

  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-transparent border border-indigo-500/20 p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
      {streak > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/20 rounded-xl flex-shrink-0">
          <span className="text-xl">🔥</span>
          <span className="text-orange-400 font-bold text-sm sm:text-base">{streak} gün</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <h3 className="text-base sm:text-lg font-semibold text-default mb-1">{heading}</h3>
        <p className="text-muted-foreground text-xs sm:text-sm mb-3">{subtext}</p>

        {!goalReached && (
          <div className="space-y-1.5">
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{dailyProgress}/{dailyGoal} soru</span>
          </div>
        )}
      </div>

      <Link
        href="/"
        className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5 text-sm sm:text-base"
      >
        <span>{goalReached ? 'Devam Et' : 'Başla'}</span>
        <span>→</span>
      </Link>
    </div>
  );
}
