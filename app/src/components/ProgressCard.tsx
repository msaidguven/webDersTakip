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
      <div className="relative p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className={`
            w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
            ${isCompleted 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : isLocked 
                ? 'bg-zinc-800 text-zinc-500'
                : 'bg-indigo-500/10 text-indigo-400'
            }
          `}>
            {isCompleted ? (
              <Icon name="check" size={28} />
            ) : isLocked ? (
              <Icon name="lock" size={24} />
            ) : (
              <span>📚</span>
            )}
          </div>
          
          {isCompleted && (
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
              Tamamlandı
            </span>
          )}
          {!isCompleted && !isLocked && (
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-full border border-indigo-500/20 animate-pulse">
              Devam Ediyor
            </span>
          )}
        </div>

        {/* Title & Info */}
        <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
          {unit.title}
        </h3>
        <p className="text-sm text-zinc-500 mb-4">{unit.subtitle}</p>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">
              {isCompleted ? 'Başarı Oranı' : 'İlerleme'}
            </span>
            <span className={`font-semibold ${isCompleted ? 'text-emerald-400' : 'text-white'}`}>
              {isCompleted ? `%${unit.successRate}` : `%${unit.progress}`}
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
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
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-sm text-zinc-500">
          <Icon name="book" size={14} />
          <span>{unit.totalTopics} Konu</span>
          <span className="mx-1">•</span>
          <Icon name="calculator" size={14} />
          <span>{unit.totalQuestions} Soru</span>
        </div>
      </div>
    </div>
  );
}
