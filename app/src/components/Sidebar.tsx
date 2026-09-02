'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from './icons';
import { useSidebarLessons } from '../viewmodels/useSidebarLessons';
import { setPendingLessonId } from '../lib/panelLessonBridge';
import { getLessonColor } from '../lib/homeMapping';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isAuthenticated: boolean;
  userName?: string;
  // Sadece panel anasayfası verir — o zaman bir derse tıklamak sayfa değiştirmeden
  // doğrudan ünite/konu listesini günceller. Başka bir panel sayfasındaysak (profil,
  // siralama, aktiviteler) bu prop yok; o durumda /panel'e gidip oraya bırakılan
  // "pending" dersi panel kendi mount olduğunda uygular (bkz. panelLessonBridge).
  onSelectLesson?: (lessonId: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export function Sidebar({ isOpen, onClose, isAuthenticated, userName, onSelectLesson }: SidebarProps) {
  const { status, lessons, gradeOptions, selectedGradeId, setSelectedGradeId, saving, saveGrade } =
    useSidebarLessons();
  const router = useRouter();

  const handleLessonClick = (lessonId: string) => {
    if (onSelectLesson) {
      onSelectLesson(lessonId);
    } else {
      setPendingLessonId(lessonId);
      router.push('/panel');
    }
    onClose?.();
  };

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
      <nav className="flex-1 px-3 py-6 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          Derslerim
        </p>

        {!isAuthenticated && (
          <p className="px-3 text-sm text-muted-foreground">
            Derslerini görmek için giriş yap.
          </p>
        )}

        {isAuthenticated && status === 'loading' && (
          <div className="space-y-1 px-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <div className="h-9 w-9 shrink-0 rounded-xl bg-white/5 animate-pulse" />
                <div className="h-3.5 flex-1 rounded-full bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {isAuthenticated && status === 'need-grade' && (
          <div className="relative mx-1 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-3.5 space-y-2.5">
            <div className="absolute -right-6 -top-6 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl" />
            <p className="relative text-sm text-default font-semibold">Önce sınıfını seç</p>
            <p className="relative text-xs text-muted-foreground leading-relaxed">
              Derslerini gösterebilmemiz için hangi sınıfta olduğunu seçmelisin.
            </p>
            <select
              value={selectedGradeId ?? ''}
              onChange={(e) => setSelectedGradeId(e.target.value ? Number(e.target.value) : null)}
              className="relative w-full text-sm rounded-xl bg-surface border border-default px-3 py-2 text-default"
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
              className="relative w-full text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 shadow-lg shadow-indigo-500/20 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}

        {isAuthenticated && status === 'ready' && lessons.length === 0 && (
          <p className="px-3 text-sm text-muted-foreground">Bu sınıf için ders bulunamadı.</p>
        )}

        {isAuthenticated &&
          status === 'ready' &&
          lessons.map((lesson, index) => (
            <button
              key={lesson.id}
              onClick={() => handleLessonClick(lesson.id)}
              className="group relative w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-colors duration-200 hover:bg-white/5"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getLessonColor(index)} text-base shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:rotate-3`}
              >
                {lesson.icon}
              </span>
              <span className="flex-1 min-w-0 text-left text-sm font-medium text-default truncate">
                {lesson.name}
              </span>
              <Icon
                name="chevron-right"
                size={14}
                className="shrink-0 text-muted-foreground opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
              />
            </button>
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
