'use client';

import React from 'react';
import { Week } from '../models/types';
import { Icon } from './icons';

interface WeekSelectorProps {
  weeks: Week[];
  selectedWeekId: number;
  onSelectWeek: (weekId: number) => void;
  onViewCalendar: () => void;
}

export function WeekSelector({ weeks, selectedWeekId, onSelectWeek, onViewCalendar }: WeekSelectorProps) {
  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">Müfredat Haftası</h2>
        <button 
          onClick={onViewCalendar}
          className="text-indigo-500 text-sm font-semibold flex items-center gap-1 hover:text-indigo-600 transition-colors"
        >
          Takvim <Icon name="chevron-right" size={16} />
        </button>
      </div>
      
      {/* Week Chips */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
        {weeks.map((week) => (
          <button
            key={week.id}
            onClick={() => onSelectWeek(week.id)}
            disabled={week.status === 'locked'}
            className={`
              flex-shrink-0 px-5 py-3 rounded-full text-center min-w-[80px] transition-all duration-300
              ${week.status === 'locked' 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60' 
                : selectedWeekId === week.id
                  ? 'bg-indigo-500 text-white scale-105 shadow-lg shadow-indigo-500/40'
                  : 'bg-white text-slate-700 border-2 border-transparent hover:border-indigo-500 hover:-translate-y-0.5 shadow-sm'
              }
            `}
          >
            <span className="block font-bold text-base">{week.number}</span>
            <span className={`block text-xs ${selectedWeekId === week.id ? 'opacity-90' : 'opacity-70'}`}>
              {week.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
