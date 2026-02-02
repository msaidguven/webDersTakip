'use client';

import React from 'react';
import { Unit } from '../models/types';
import { Icon } from './icons';

interface ProgressCardProps {
  unit: Unit;
  onClick: () => void;
}

export function ProgressCard({ unit, onClick }: ProgressCardProps) {
  const isLocked = unit.status === 'locked';
  const isCompleted = unit.status === 'completed';

  return (
    <div 
      onClick={onClick}
      className={`
        group relative rounded-2xl overflow-hidden cursor-pointer card-hover
        ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      {/* Gradient Border Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-pink-500/30 p-[1px]">
        <div className="w-full h-full rounded-2xl bg-[#18181b]" />
      </div>

      {/* Content */}
      <div className="relative p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className={`
            w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl
            ${isCompleted 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : isLocked 
                ? 'bg-zinc-800 text-muted'
                : 'bg-indigo-500/10 text-indigo-400'
            }
          `}>
            {isCompleted ? (
              <Icon name="check" size={24} className="sm:w-7 sm:h-7" />
            ) : isLocked ? (
              <Icon name="lock" size={20} className="sm:w-6 sm:h-6" />
            ) : (
              <span>📚</span>
            )}
          </div>
          
          {isCompleted && (
            <span className="px-2 sm:px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] sm:text-xs font-semibold rounded-full border border-emerald-500/20">
              Tamamlandı
            </span>
          )}
          {!isCompleted && !isLocked && (
            <span className="px-2 sm:px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] sm:text-xs font-semibold rounded-full border border-indigo-500/20 animate-pulse">
              Devam Ediyor
            </span>
          )}
        </div>

        {/* Title & Info */}
        <h3 className="text-base sm:text-lg font-semibold text-default mb-1 sm:mb-2 group-hover:text-indigo-400 transition-colors">
          {unit.title}
        </h3>
        <p className="text-xs sm:text-sm text-muted mb-3 sm:mb-4">{unit.subtitle}</p>

        {/* Progress Bar */}
        <div className="space-y-1.5 sm:space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted">
              {isCompleted ? 'Başarı Oranı' : 'İlerleme'}
            </span>
            <span className={`font-semibold ${isCompleted ? 'text-emerald-400' : 'text-default'}`}>
              {isCompleted ? `%${unit.successRate}` : `%${unit.progress}`}
            </span>
          </div>
          <div className="h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`
                h-full rounded-full transition-all duration-1000
                ${isCompleted 
                  ? 'bg-emerald-500' 
                  : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                }
              `}
              style={{ width: `${isCompleted ? 100 : unit.progress}%` }}
            />
          </div>
        </div>

        {/* Topics Preview */}
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-default flex items-center gap-2 text-xs sm:text-sm text-muted">
          <Icon name="book" size={12} className="sm:w-3.5 sm:h-3.5" />
          <span>{unit.totalTopics} Konu</span>
          <span className="mx-1">•</span>
          <Icon name="calculator" size={12} className="sm:w-3.5 sm:h-3.5" />
          <span>{unit.totalQuestions} Soru</span>
        </div>
      </div>
    </div>
  );
}
