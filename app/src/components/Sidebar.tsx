'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from './icons';
import { useSidebarLessons } from '../viewmodels/useSidebarLessons';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isAuthenticated: boolean;
  userName?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function Sidebar({ isOpen, onClose, isAuthenticated, userName }: SidebarProps) {
  const { status, lessons, gradeOptions, selectedGradeId, setSelectedGradeId, saving, saveGrade } =
    useSidebarLessons();
  return (
    <aside className={`
      fixed left-0 top-0 h-screen w-[280px] bg-surface border-r border-default z-50 flex flex-col
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

      {/* Logo Area */}
      <div className="p-6 border-b border-default">
        <Link href="/" className="flex items-center gap-3 group" onClick={onClose}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
            <span className="text-xl font-bold text-default">📚</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-default tracking-tight">Ders Takip</h1>
            <p className="text-xs text-muted-foreground">Öğrenme Yolculuğu</p>
          </div>
        </Link>
      </div>

      {/* Dersler */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Derslerim
        </p>

        {!isAuthenticated && (
          <p className="px-4 text-sm text-muted-foreground">
            Derslerini görmek için giriş yap.
          </p>
        )}

        {isAuthenticated && status === 'loading' && (
          <div className="space-y-2 px-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {isAuthenticated && status === 'need-grade' && (
          <div className="mx-2 p-3 rounded-xl bg-white/5 border border-default space-y-2">
            <p className="text-sm text-default font-medium">Önce sınıfını seç</p>
            <p className="text-xs text-muted-foreground">
              Derslerini gösterebilmemiz için hangi sınıfta olduğunu seçmelisin.
            </p>
            <select
              value={selectedGradeId ?? ''}
              onChange={(e) => setSelectedGradeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-sm rounded-lg bg-surface border border-default px-2 py-2 text-default"
            >
              <option value="">Sınıf seç...</option>
              {gradeOptions.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
            <button
              onClick={saveGrade}
              disabled={!selectedGradeId || saving}
              className="w-full text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}

        {isAuthenticated && status === 'ready' && lessons.length === 0 && (
          <p className="px-4 text-sm text-muted-foreground">Bu sınıf için ders bulunamadı.</p>
        )}

        {isAuthenticated &&
          status === 'ready' &&
          lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={lesson.href}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-muted-foreground hover:text-default hover:bg-white/5"
            >
              <Icon name="book" size={20} className="transition-colors group-hover:text-default" />
              <span className="font-medium">{lesson.name}</span>
            </Link>
          ))}
      </nav>

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
