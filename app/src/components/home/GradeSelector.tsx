'use client';

import React from 'react';
import { Grade } from '../../models/homeTypes';

interface GradeSelectorProps {
  grades: Grade[];
  isLoading: boolean;
  error: string | null;
  onSelect: (grade: Grade) => void;
}

export function GradeSelector({ grades, isLoading, error, onSelect }: GradeSelectorProps) {
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Sınıflar <span className="gradient-text">Yükleniyor</span>...
          </h1>
          <p className="text-zinc-400 text-lg">Lütfen bekleyin</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 animate-pulse"
            >
              <div className="w-12 h-12 rounded-xl bg-zinc-800 mb-4" />
              <div className="h-6 bg-zinc-800 rounded mb-2 w-24" />
              <div className="h-4 bg-zinc-800 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto text-center">
        <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 mb-4">Sınıflar yüklenirken bir hata oluştu:</p>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="max-w-6xl mx-auto text-center">
        <div className="p-8 rounded-2xl bg-zinc-900/50 border border-white/5">
          <p className="text-zinc-400">Henüz sınıf bulunmamaktadır.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">
          Hangi <span className="gradient-text">Sınıf</span>tasın?
        </h1>
        <p className="text-zinc-400 text-lg">
          Sınıfını seçerek sana özel içeriklere ulaşabilirsin
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {grades.map((grade) => (
          <button
            key={grade.id}
            onClick={() => onSelect(grade)}
            className="group relative p-6 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/20 transition-all duration-300 card-hover text-left"
          >
            {/* Gradient Border on Hover */}
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${grade.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
            
            <div className="relative">
              <div className="text-4xl mb-4">{grade.icon}</div>
              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-300 transition-all">
                {grade.name}
              </h3>
              <p className="text-sm text-zinc-500">{grade.description}</p>
            </div>

            {/* Arrow */}
            <div className="absolute bottom-6 right-6 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
              <span className="text-white">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
