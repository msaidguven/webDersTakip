'use client';

import React from 'react';
import { Grade } from '../../models/homeTypes';

interface GradeSelectorProps {
  grades: Grade[];
  isLoading: boolean;
  error?: string | null;
  onSelect: (grade: Grade) => void;
}

export function GradeSelector({ grades, isLoading, error, onSelect }: GradeSelectorProps) {
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold text-default mb-3 sm:mb-4">
            Sınıflar <span className="gradient-text">Yükleniyor</span>...
          </h1>
          <p className="text-muted text-base sm:text-lg">Lütfen bekleyin</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-surface-elevated border border-default animate-pulse"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-surface mb-3 sm:mb-4 border border-default" />
              <div className="h-5 sm:h-6 bg-surface rounded mb-2 w-20 sm:w-24 border border-default" />
              <div className="h-3 sm:h-4 bg-surface rounded w-28 sm:w-32 border border-default" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto text-center px-4">
        <div className="p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-500 mb-3 sm:mb-4 text-sm sm:text-base">Sınıflar yüklenirken bir hata oluştu:</p>
          <p className="text-muted text-sm sm:text-base">{error}</p>
        </div>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="max-w-6xl mx-auto text-center px-4">
        <div className="p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-surface-elevated border border-default">
          <p className="text-muted text-sm sm:text-base">Henüz sınıf bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl font-bold text-default mb-3 sm:mb-4">
          Hangi <span className="gradient-text">Sınıf</span>tasın?
        </h1>
        <p className="text-muted text-base sm:text-lg">
          Sınıfını seçerek sana özel içeriklere ulaşabilirsin
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {grades.map((grade) => (
          <button
            key={grade.id}
            onClick={() => onSelect(grade)}
            className="group relative p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-surface-elevated border border-default hover:border-default/20 transition-all duration-300 card-hover text-left"
          >
            {/* Gradient Border on Hover */}
            <div className={`absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br ${grade.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
            
            <div className="relative">
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">{grade.icon}</div>
              <h3 className="text-lg sm:text-xl font-bold text-default mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-300 transition-all">
                {grade.name}
              </h3>
              <p className="text-xs sm:text-sm text-muted line-clamp-2">{grade.description}</p>
            </div>

            {/* Arrow */}
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
              <span className="text-default text-sm sm:text-base">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
