'use client';

import React from 'react';
import { Stat } from '../models/types';
import { Icon, getIconColorClasses } from './icons';

interface StatsGridProps {
  stats: Stat[];
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {stats.map((stat) => (
        <div 
          key={stat.id}
          className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-md transition-all duration-300"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 ${getIconColorClasses(stat.iconColor)}`}>
            <Icon name={stat.icon} size={24} />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mb-1">
            {stat.value}
          </div>
          <div className="text-sm text-slate-500 font-medium">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
