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
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-white">Haftalık İlerleme</h3>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            ←
          </button>
          <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            →
          </button>
        </div>
      </div>

      {/* Week Cards */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {weeks.map((week) => {
          const isActive = week.id === currentWeekId;
          const isLocked = week.status === 'locked';
          
          return (
            <button
              key={week.id}
              onClick={() => !isLocked && onSelectWeek(week.id)}
              disabled={isLocked}
              className={`
                relative p-4 rounded-xl transition-all duration-300
                ${isActive 
                  ? 'bg-indigo-500/20 border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/20' 
                  : isLocked 
                    ? 'bg-zinc-800/50 border border-white/5 opacity-50 cursor-not-allowed'
                    : 'bg-zinc-800/50 border border-white/5 hover:border-white/20 hover:bg-zinc-800'
                }
              `}
            >
              <div className={`text-2xl font-bold ${isActive ? 'text-indigo-400' : 'text-white'}`}>
                {week.number}
              </div>
              <div className={`text-xs mt-1 ${isActive ? 'text-indigo-400/70' : 'text-zinc-500'}`}>
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
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-zinc-500">Bu Hafta</span>
          <span className="text-white font-medium">5/7 Gün</span>
        </div>
        
        <div className="flex gap-2">
          {days.map((day, index) => {
            const isCompleted = index < 5;
            const isToday = index === 4;
            
            return (
              <div key={day} className="flex-1 text-center">
                <div 
                  className={`
                    h-12 rounded-xl mb-2 transition-all duration-300
                    ${isCompleted 
                      ? isToday 
                        ? 'bg-gradient-to-b from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'
                        : 'bg-emerald-500/20 border border-emerald-500/30'
                      : 'bg-zinc-800 border border-white/5'
                    }
                  `}
                />
                <span className={`text-xs ${isToday ? 'text-indigo-400 font-medium' : 'text-zinc-500'}`}>
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
