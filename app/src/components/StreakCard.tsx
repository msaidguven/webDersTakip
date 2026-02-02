'use client';

import React from 'react';
import { User } from '../models/types';
import { Icon } from './icons';

interface StreakCardProps {
  user: User;
}

export function StreakCard({ user }: StreakCardProps) {
  const progressPercent = (user.dailyProgress / user.dailyGoal) * 100;
  
  return (
    <div className="relative bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 rounded-2xl p-6 text-default shadow-xl overflow-hidden">
      {/* Decorative circle */}
      <div className="absolute -top-1/2 -right-20 w-48 h-48 bg-white/10 rounded-full" />
      
      <div className="relative z-10 flex justify-between items-start mb-4">
        <div>
          <div className="text-sm font-semibold opacity-90 uppercase tracking-wide mb-2">
            Günlük Seri
          </div>
          <div className="text-5xl font-extrabold leading-none mb-2">
            {user.streak} 🔥
          </div>
          <div className="text-base opacity-90">
            Gün üst üste çalışma
          </div>
        </div>
        <div className="text-3xl animate-pulse">
          <Icon name="fire" className="text-default" size={40} />
        </div>
      </div>
      
      {/* Daily Goal Progress */}
      <div className="mt-5 bg-white/20 rounded-xl p-3 flex justify-between items-center backdrop-blur-sm">
        <span className="text-sm font-semibold">Günlük Hedef: {user.dailyGoal} Soru</span>
        <span className="text-sm font-bold">{user.dailyProgress}/{user.dailyGoal}</span>
      </div>
      
      {/* Progress bar */}
      <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
        <div 
          className="h-full bg-white rounded-full transition-all duration-1000"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
