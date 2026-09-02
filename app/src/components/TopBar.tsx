'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from './icons';

interface TopBarProps {
  notificationCount: number;
  // Verilmezse (ör. profil sayfasında) rozet hiç gösterilmez — yanlış/bayat bir sayı
  // göstermektense sessizce atlamak tercih edildi.
  streak?: number;
  isAuthenticated: boolean;
  userName?: string;
  title?: string;
  subtitle?: string;
  onNotificationClick: () => void;
  onMenuClick?: () => void;
  onStartQuiz?: () => void;
}

export function TopBar({ notificationCount, streak, isAuthenticated, userName, title = 'Dashboard', subtitle, onNotificationClick, onMenuClick, onStartQuiz }: TopBarProps) {
  const defaultSubtitle = isAuthenticated
    ? `Hoş geldin, ${userName}! Bugün harika bir gün öğrenmek için.`
    : 'Panelini görmek için giriş yap.';

  return (
    <header className="h-[72px] bg-background/95 backdrop-blur-xl border-b border-default flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-40">
      {/* Left - Menu & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden w-10 h-10 rounded-xl bg-surface border border-default flex items-center justify-center text-muted-foreground hover:text-default hover:border-default/20 transition-all"
        >
          <Icon name="menu" size={20} />
        </button>
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-default">{title}</h2>
          <p className="hidden sm:block text-sm text-muted-foreground">{subtitle ?? defaultSubtitle}</p>
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Streak Badge */}
        {!isAuthenticated ? (
          <Link
            href="/login?redirectTo=/panel"
            className="px-3 sm:px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-xs sm:text-sm"
          >
            Giriş Yap
          </Link>
        ) : streak != null ? (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/20 rounded-xl">
            <span className="text-lg sm:text-xl">🔥</span>
            <div>
              <span className="text-orange-400 font-bold text-sm sm:text-base">{streak}</span>
              <span className="text-muted-foreground text-xs sm:text-sm ml-0.5 sm:ml-1">gün</span>
            </div>
          </div>
        ) : null}

        {/* Notifications */}
        <button 
          onClick={onNotificationClick}
          className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-default flex items-center justify-center hover:bg-surface-elevated hover:border-default/20 transition-all"
        >
          <Icon name="bell" className="text-muted-foreground" size={18} />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-default text-[10px] sm:text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
              {notificationCount}
            </span>
          )}
        </button>

        {/* Quick Action Button */}
        <button
          onClick={onStartQuiz}
          className="hidden sm:flex items-center gap-2 px-4 lg:px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-default font-medium rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
        >
          <Icon name="play" size={18} />
          <span className="hidden lg:inline">Çalışmaya Başla</span>
          <span className="lg:hidden">Başla</span>
        </button>
      </div>
    </header>
  );
}
