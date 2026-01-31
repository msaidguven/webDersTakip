'use client';

import React from 'react';
import { Activity } from '../models/types';
import { Icon, getIconColorClasses } from './icons';

interface ActivityListProps {
  activities: Activity[];
  onViewHistory: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Bugün';
  } else if (diffDays === 1) {
    return 'Dün';
  } else if (diffDays < 7) {
    return `${diffDays} gün önce`;
  } else {
    return new Date(date).toLocaleDateString('tr-TR');
  }
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-green-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

export function ActivityList({ activities, onViewHistory }: ActivityListProps) {
  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">Son Aktiviteler</h2>
        <button 
          onClick={onViewHistory}
          className="text-indigo-500 text-sm font-semibold flex items-center gap-1 hover:text-indigo-600 transition-colors"
        >
          Geçmiş <Icon name="chevron-right" size={16} />
        </button>
      </div>
      
      {/* Activity List */}
      <div className="bg-white rounded-2xl p-2 shadow-sm">
        {activities.map((activity, index) => (
          <div 
            key={activity.id}
            className={`
              flex items-center p-4 rounded-xl transition-colors hover:bg-slate-50
              ${index !== activities.length - 1 ? 'border-b border-slate-100' : ''}
            `}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 ${getIconColorClasses(activity.iconColor)}`}>
              <Icon name={activity.icon} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-slate-800 text-sm truncate">
                {activity.title}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {formatRelativeTime(activity.timestamp)} • {activity.questionCount} Soru • {activity.durationMinutes} Dakika
              </div>
            </div>
            <div className={`font-extrabold text-lg ${getScoreColor(activity.score)}`}>
              {activity.score}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
