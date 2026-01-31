'use client';

import React from 'react';
import { Icon } from './icons';

interface TopBarProps {
  notificationCount: number;
  streak: number;
  onNotificationClick: () => void;
}

export function TopBar({ notificationCount, streak, onNotificationClick }: TopBarProps) {
  return (
    <header className="h-[72px] bg-background/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-40">
      {/* Left - Breadcrumb/Title */}
      <div>
        <h2 className="text-lg font-semibold text-white">Dashboard</h2>
        <p className="text-sm text-zinc-500">Hoş geldin, Ali! Bugün harika bir gün öğrenmek için.</p>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Ara..."
            className="w-64 bg-surface border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Streak Badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/20 rounded-xl">
          <span className="text-xl">🔥</span>
          <div>
            <span className="text-orange-400 font-bold">{streak}</span>
            <span className="text-zinc-500 text-sm ml-1">gün</span>
          </div>
        </div>

        {/* Notifications */}
        <button 
          onClick={onNotificationClick}
          className="relative w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center hover:bg-surface-elevated hover:border-white/20 transition-all"
        >
          <Icon name="bell" className="text-zinc-400" size={20} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Quick Action Button */}
        <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5">
          <Icon name="play" size={18} />
          <span>Çalışmaya Başla</span>
        </button>
      </div>
    </header>
  );
}
