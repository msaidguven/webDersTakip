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
    <div className="group flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getIconColorClasses(activity.iconColor)}`}>
        <Icon name={activity.icon} size={22} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white group-hover:text-indigo-400 transition-colors truncate">
          {activity.title}
        </h4>
        <div className="flex items-center gap-2 text-sm text-zinc-500 mt-0.5">
          <span>{formatRelativeTime(activity.timestamp)}</span>
          <span>•</span>
          <span>{activity.questionCount} soru</span>
          <span>•</span>
          <span>{activity.durationMinutes} dk</span>
        </div>
      </div>

      {/* Score Badge */}
      <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${scoreClass}`}>
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
    <div className="rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-semibold text-white">Son Aktiviteler</h3>
        <button className="text-sm text-zinc-500 hover:text-indigo-400 transition-colors">
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
        <div className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-zinc-500">Henüz bir aktivite yok</p>
        </div>
      )}
    </div>
  );
}
