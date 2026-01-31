'use client';

import React from 'react';
import { Grade } from '../../models/homeTypes';

interface GradeSelectorProps {
  grades: Grade[];
  onSelect: (grade: Grade) => void;
}

export function GradeSelector({ grades, onSelect }: GradeSelectorProps) {
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
