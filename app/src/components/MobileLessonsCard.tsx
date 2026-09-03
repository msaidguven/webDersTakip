'use client';

import React from 'react';
import { Icon } from './icons';
import { useSidebarLessons } from '../viewmodels/useSidebarLessons';
import { getLessonColor } from '../lib/homeMapping';

interface MobileLessonsCardProps {
  isAuthenticated: boolean;
  selectedLessonId?: string | null;
  onSelectLesson?: (lessonId: string) => void;
}

export function MobileLessonsCard({
  isAuthenticated,
  selectedLessonId,
  onSelectLesson,
}: MobileLessonsCardProps) {
  const { status, lessons, gradeOptions, selectedGradeId, setSelectedGradeId, saving, saveGrade } =
    useSidebarLessons();

  if (!isAuthenticated) return null;

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-surface border border-default p-4 sm:p-6 shadow-xl shadow-indigo-500/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Icon name="book" size={18} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-default">Derslerim</h2>
            <p className="text-xs text-muted-foreground">Ünitelerini görüntülemek için bir ders seç</p>
          </div>
        </div>
      </div>

      {/* States */}
      {status === 'loading' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {status === 'need-grade' && (
        <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-default">
            <span>🎓</span> Sınıfını Seç
          </div>
          <p className="text-xs text-muted-foreground">
            Derslerini listeleyebilmemiz için sınıfını seçmelisin.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedGradeId ?? ''}
              onChange={(e) => setSelectedGradeId(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 text-sm rounded-xl bg-surface border border-default px-3 py-2 text-default outline-none focus:border-indigo-500"
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
              className="text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 hover:opacity-90 active:scale-95"
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && lessons.length === 0 && (
        <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
          Bu sınıf için ders bulunamadı.
        </p>
      )}

      {status === 'ready' && lessons.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {lessons.map((lesson, index) => {
            const isSelected = selectedLessonId === lesson.id;
            return (
              <button
                key={lesson.id}
                onClick={() => onSelectLesson?.(lesson.id)}
                className={`group relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-200 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                    : 'bg-surface/80 hover:bg-surface border-default hover:border-indigo-500/30 text-default'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getLessonColor(
                    index
                  )} text-lg shadow-md transition-transform duration-200 group-hover:scale-105`}
                >
                  {lesson.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold truncate leading-tight">
                    {lesson.name}
                  </p>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-400 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      Seçili
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
