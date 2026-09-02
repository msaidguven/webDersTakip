'use client';

import React from 'react';

interface WeeklyProgressProps {
  // Bu haftanın Pazartesi'den Pazar'a 7 günü için gerçekten soru çözülüp çözülmediği
  // (bkz. dashboardStreak.ts:getWeeklyActiveDays) — eskiden ilk 5 gün hardcoded "tamamlandı"
  // gösteriliyordu (bkz. kullanıcıyla 2026-09-02 tartışması).
  activeDays?: boolean[];
}

// Eskiden burada müfredat haftası kartları (1-5, "Şimdi/Gelecek") da vardı — sadece görsel
// seçim dışında hiçbir işlevi olmadığı, kafa karıştırdığı için kaldırıldı (bkz. kullanıcıyla
// 2026-09-02 tartışması). Kalan tek şey: bu takvim haftasının günlük pratik takibi.
export function WeeklyProgress({ activeDays = new Array(7).fill(false) }: WeeklyProgressProps) {
  const days = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];
  const todayIndex = (() => {
    const day = new Date().getDay(); // 0=Pazar, 1=Pazartesi, ... 6=Cumartesi
    return day === 0 ? 6 : day - 1;
  })();
  const completedCount = activeDays.filter(Boolean).length;

  return (
    <div className="rounded-xl sm:rounded-2xl bg-surface-elevated border border-default p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="font-semibold text-default text-sm sm:text-base">Bu Hafta</h3>
        <span className="text-default font-medium text-xs sm:text-sm">{completedCount}/7 Gün</span>
      </div>

      <div className="flex gap-1 sm:gap-2">
        {days.map((day, index) => {
          const isCompleted = activeDays[index] ?? false;
          const isToday = index === todayIndex;

          return (
            <div key={day} className="flex-1 text-center">
              <div
                className={`
                  h-8 sm:h-12 rounded-lg sm:rounded-xl mb-1 sm:mb-2 transition-all duration-300
                  ${isCompleted
                    ? isToday
                      ? 'bg-gradient-to-b from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'
                      : 'bg-emerald-500/20 border border-emerald-500/30'
                    : isToday
                      ? 'bg-zinc-800 border-2 border-dashed border-indigo-500/40'
                      : 'bg-zinc-800 border border-default'
                  }
                `}
              />
              <span className={`text-[10px] sm:text-xs ${isToday ? 'text-indigo-400 font-medium' : 'text-muted-foreground'}`}>
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
