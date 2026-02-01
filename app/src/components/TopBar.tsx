'use client';

import React from 'react';
import { Icon } from './icons';

interface TopBarProps {
  notificationCount: number;
  streak: number;
  onNotificationClick: () => void;
  onMenuClick?: () => void;
}

export function TopBar({ notificationCount, streak, onNotificationClick, onMenuClick }: TopBarProps) {
  return (
    <header className="h-[72px] bg-background/95 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-40">
      {/* Left - Menu & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
        >
          <Icon name="menu" size={20} />
        </button>
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white">Dashboard</h2>
          <p className="hidden sm:block text-sm text-zinc-500">Hoş geldin, Ali! Bugün harika bir gün öğrenmek için.</p>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search - Hidden on mobile */}
        <div className="hidden sm:block relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Ara..."
            className="w-48 lg:w-64 bg-surface border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Streak Badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/20 rounded-xl">
          <span className="text-lg sm:text-xl">🔥</span>
          <div>
            <span className="text-orange-400 font-bold text-sm sm:text-base">{streak}</span>
            <span className="text-zinc-500 text-xs sm:text-sm ml-0.5 sm:ml-1">gün</span>
          </div>
        </div>

        {/* Notifications */}
        <button 
          onClick={onNotificationClick}
          className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center hover:bg-surface-elevated hover:border-white/20 transition-all"
        >
          <Icon name="bell" className="text-zinc-400" size={18} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Quick Action Button */}
        <button className="hidden sm:flex items-center gap-2 px-4 lg:px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5">
          <Icon name="play" size={18} />
          <span className="hidden lg:inline">Çalışmaya Başla</span>
          <span className="lg:hidden">Başla</span>
        </button>
      </div>
    </header>
  );
}
