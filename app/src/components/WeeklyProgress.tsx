'use client';

import React from 'react';
import { Week } from '../models/types';

interface WeeklyProgressProps {
  weeks: Week[];
  currentWeekId: number;
  onSelectWeek: (weekId: number) => void;
}

export function WeeklyProgress({ weeks, currentWeekId, onSelectWeek }: WeeklyProgressProps) {
  const days = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pa'];

  return (
    <div className="rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="font-semibold text-white text-sm sm:text-base">Haftalık İlerleme</h3>
        <div className="flex gap-1.5 sm:gap-2">
          <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-sm">
            ←
          </button>
          <button className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-sm">
            →
          </button>
        </div>
      </div>

      {/* Week Cards */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-6">
        {weeks.map((week) => {
          const isActive = week.id === currentWeekId;
          const isLocked = week.status === 'locked';
          
          return (
            <button
              key={week.id}
              onClick={() => !isLocked && onSelectWeek(week.id)}
              disabled={isLocked}
              className={`
                relative p-2 sm:p-4 rounded-lg sm:rounded-xl transition-all duration-300
                ${isActive 
                  ? 'bg-indigo-500/20 border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/20' 
                  : isLocked 
                    ? 'bg-zinc-800/50 border border-white/5 opacity-50 cursor-not-allowed'
                    : 'bg-zinc-800/50 border border-white/5 hover:border-white/20 hover:bg-zinc-800'
                }
              `}
            >
              <div className={`text-lg sm:text-2xl font-bold ${isActive ? 'text-indigo-400' : 'text-white'}`}>
                {week.number}
              </div>
              <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${isActive ? 'text-indigo-400/70' : 'text-zinc-500'}`}>
                {week.label}
              </div>
              
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Daily Progress */}
      <div>
        <div className="flex items-center justify-between text-xs sm:text-sm mb-2 sm:mb-3">
          <span className="text-zinc-500">Bu Hafta</span>
          <span className="text-white font-medium">5/7 Gün</span>
        </div>
        
        <div className="flex gap-1 sm:gap-2">
          {days.map((day, index) => {
            const isCompleted = index < 5;
            const isToday = index === 4;
            
            return (
              <div key={day} className="flex-1 text-center">
                <div 
                  className={`
                    h-8 sm:h-12 rounded-lg sm:rounded-xl mb-1 sm:mb-2 transition-all duration-300
                    ${isCompleted 
                      ? isToday 
                        ? 'bg-gradient-to-b from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'
                        : 'bg-emerald-500/20 border border-emerald-500/30'
                      : 'bg-zinc-800 border border-white/5'
                    }
                  `}
                />
                <span className={`text-[10px] sm:text-xs ${isToday ? 'text-indigo-400 font-medium' : 'text-zinc-500'}`}>
                  {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
