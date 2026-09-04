'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { WeeklyProgress } from './WeeklyProgress';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isAuthenticated: boolean;
  userName?: string;
  weeklyActiveDays?: boolean[];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function Sidebar({ isOpen, onClose, isAuthenticated, userName, weeklyActiveDays }: SidebarProps) {
  return (
    <aside className={`
      fixed left-0 top-[60px] sm:top-[72px] h-[calc(100vh-60px)] sm:h-[calc(100vh-72px)] w-[280px] bg-surface border-r border-default z-40 flex flex-col
      transition-transform duration-300 ease-in-out
      lg:translate-x-0
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      {/* Close Button for Mobile */}
      <button
        onClick={onClose}
        className="lg:hidden absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-muted-foreground hover:text-default hover:bg-white/20 transition-colors z-50"
      >
        ✕
      </button>

      {/* Dersler kartları artık panel içeriğinde (LessonExplorer) — sidebar'da onun yerine
          haftalık ilerleme özeti var. Mobilde panel anasayfasında istatistiklerin altında da
          ayrıca gösterildiği için mobil sidebar'da gizli, aynı bilgiyi iki kez göstermemek için. */}
      <div className="hidden lg:block flex-1 px-3 py-6 overflow-y-auto">
        {!isAuthenticated ? (
          <p className="px-3 text-sm text-muted-foreground">Haftalık ilerlemeni görmek için giriş yap.</p>
        ) : (
          <WeeklyProgress activeDays={weeklyActiveDays} />
        )}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-default">
        {isAuthenticated ? (
          <Link href="/profil" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-default font-semibold">
              {getInitials(userName || '?')}
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-default group-hover:text-indigo-400 transition-colors">
                {userName}
              </p>
              <p className="text-xs text-muted-foreground">Öğrenci</p>
            </div>
            <Icon name="chevron-right" size={16} className="text-muted-foreground group-hover:text-muted-foreground" />
          </Link>
        ) : (
          <Link
            href="/login?redirectTo=/panel"
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
          >
            <span>Giriş Yap</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
