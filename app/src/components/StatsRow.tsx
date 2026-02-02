'use client';

import React from 'react';
import { Icon } from './icons';
import { Stat } from '../models/types';

interface StatCardProps {
  stat: Stat;
  index: number;
}

function StatCard({ stat, index }: StatCardProps) {
  const gradients = [
    'from-indigo-500/20 via-indigo-500/10 to-transparent border-indigo-500/20',
    'from-purple-500/20 via-purple-500/10 to-transparent border-purple-500/20',
    'from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-500/20',
    'from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/20',
  ];

  const iconColors = [
    'text-indigo-400 bg-indigo-500/10',
    'text-purple-400 bg-purple-500/10',
    'text-cyan-400 bg-cyan-500/10',
    'text-emerald-400 bg-emerald-500/10',
  ];

  const gradient = gradients[index % gradients.length];
  const iconColor = iconColors[index % iconColors.length];

  return (
    <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} border p-4 sm:p-6 card-hover`}>
      {/* Background glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
      
      <div className="relative">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${iconColor} flex items-center justify-center mb-3 sm:mb-4`}>
          <Icon name={stat.icon} size={20} className="sm:w-6 sm:h-6" />
        </div>
        
        <div className="text-xl sm:text-3xl font-bold text-default mb-0.5 sm:mb-1">
          {stat.value}
        </div>
        <div className="text-xs sm:text-sm text-muted">
          {stat.label}
        </div>
      </div>

      {/* Sparkline placeholder */}
      <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 opacity-30 hidden sm:block">
        <svg width="60" height="30" viewBox="0 0 60 30" fill="none">
          <path 
            d="M0 20 Q10 15, 15 18 T30 12 T45 15 T60 8" 
            stroke="currentColor" 
            strokeWidth="2" 
            fill="none"
            className="text-default"
          />
        </svg>
      </div>
    </div>
  );
}

interface StatsRowProps {
  stats: Stat[];
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
      {stats.map((stat, index) => (
        <StatCard key={stat.id} stat={stat} index={index} />
      ))}
    </div>
  );
}
