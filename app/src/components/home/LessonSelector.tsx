'use client';

import React from 'react';
import { Grade, Lesson } from '../../models/homeTypes';
import { Icon } from '../icons';

interface LessonSelectorProps {
  grade: Grade;
  lessons: Lesson[];
  isLoading: boolean;
  error: string | null;
  onSelect: (lesson: Lesson) => void;
  onBack: () => void;
}

export function LessonSelector({ grade, lessons, isLoading, error, onSelect, onBack }: LessonSelectorProps) {
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={onBack}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
          >
            ←
          </button>
          <div>
            <p className="text-xs sm:text-sm text-zinc-500 mb-0.5 sm:mb-1">Seçilen Sınıf</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span>{grade.icon}</span>
              <span className="truncate max-w-[200px] sm:max-w-none">{grade.name}</span>
            </h2>
          </div>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Dersler <span className="gradient-text">Yükleniyor</span>...
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">Lütfen bekleyin</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 animate-pulse"
            >
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-zinc-800 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-5 sm:h-6 bg-zinc-800 rounded mb-2 w-24 sm:w-32" />
                  <div className="h-3 sm:h-4 bg-zinc-800 rounded w-32 sm:w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        {/* Header */}
        <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={onBack}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
          >
            ←
          </button>
          <div>
            <p className="text-xs sm:text-sm text-zinc-500 mb-0.5 sm:mb-1">Seçilen Sınıf</p>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <span>{grade.icon}</span>
              <span className="truncate max-w-[200px] sm:max-w-none">{grade.name}</span>
            </h2>
          </div>
        </div>

        <div className="text-center">
          <div className="p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 mb-3 sm:mb-4 text-sm sm:text-base">Dersler yüklenirken bir hata oluştu:</p>
            <p className="text-zinc-400 text-sm sm:text-base">{error}</p>
            <button
              onClick={onBack}
              className="mt-4 sm:mt-6 px-5 sm:px-6 py-2.5 sm:py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-all text-sm sm:text-base"
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <button
          onClick={onBack}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
        >
          ←
        </button>
        <div>
          <p className="text-xs sm:text-sm text-zinc-500 mb-0.5 sm:mb-1">Seçilen Sınıf</p>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span>{grade.icon}</span>
            <span className="truncate max-w-[200px] sm:max-w-none">{grade.name}</span>
          </h2>
        </div>
      </div>

      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-3xl font-bold text-white mb-2">
          Hangi <span className="gradient-text">Derse</span> Çalışmak İstiyorsun?
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base">Dersini seçerek üniteleri görüntüle</p>
      </div>

      {lessons.length === 0 ? (
        <div className="text-center p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5">
          <p className="text-zinc-400 text-sm sm:text-base">Bu sınıf için henüz ders bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              onClick={() => onSelect(lesson)}
              className="group p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/20 transition-all duration-300 card-hover text-left flex items-center gap-3 sm:gap-5"
            >
              {/* Icon */}
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br ${lesson.color} flex items-center justify-center text-2xl sm:text-3xl shadow-lg flex-shrink-0`}>
                {lesson.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5 sm:mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-300 transition-all truncate">
                  {lesson.name}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-500 mb-2 sm:mb-3 line-clamp-1">{lesson.description}</p>
                
                {/* Stats */}
                <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Icon name="book" size={12} className="sm:w-[14px] sm:h-[14px]" />
                    {lesson.unitCount} Ünite
                  </span>
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Icon name="check-circle" size={12} className="sm:w-[14px] sm:h-[14px]" />
                    {lesson.questionCount} Soru
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 flex-shrink-0">
                <span className="text-white text-sm sm:text-base">→</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
