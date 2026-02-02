'use client';

import React from 'react';
import { Activity } from '../models/types';
import { Icon, getIconColorClasses } from './icons';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) return `${diffMins} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;
  return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (score >= 70) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
  if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
}

interface ActivityItemProps {
  activity: Activity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const scoreClass = getScoreColor(activity.score);

  return (
    <div className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
      {/* Icon */}
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${getIconColorClasses(activity.iconColor)}`}>
        <Icon name={activity.icon} size={18} className="sm:w-[22px] sm:h-[22px]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-default group-hover:text-indigo-400 transition-colors truncate text-sm sm:text-base">
          {activity.title}
        </h4>
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted mt-0.5">
          <span>{formatRelativeTime(activity.timestamp)}</span>
          <span>•</span>
          <span>{activity.questionCount} soru</span>
          <span>•</span>
          <span>{activity.durationMinutes} dk</span>
        </div>
      </div>

      {/* Score Badge */}
      <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold border ${scoreClass}`}>
        %{activity.score}
      </div>
    </div>
  );
}

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-surface-elevated border border-default overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-default flex items-center justify-between">
        <h3 className="font-semibold text-default text-sm sm:text-base">Son Aktiviteler</h3>
        <button className="text-xs sm:text-sm text-muted hover:text-indigo-400 transition-colors">
          Tümünü Gör →
        </button>
      </div>

      {/* Activity List */}
      <div className="divide-y divide-white/5">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>

      {/* Empty State (hidden when there are activities) */}
      {activities.length === 0 && (
        <div className="p-6 sm:p-8 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <span className="text-xl sm:text-2xl">📋</span>
          </div>
          <p className="text-muted text-sm sm:text-base">Henüz bir aktivite yok</p>
        </div>
      )}
    </div>
  );
}
