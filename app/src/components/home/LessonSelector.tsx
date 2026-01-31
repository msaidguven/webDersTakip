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
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
          >
            ←
          </button>
          <div>
            <p className="text-sm text-zinc-500 mb-1">Seçilen Sınıf</p>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>{grade.icon}</span>
              {grade.name}
            </h2>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Dersler <span className="gradient-text">Yükleniyor</span>...
          </h1>
          <p className="text-zinc-400">Lütfen bekleyin</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-zinc-900/50 border border-white/5 animate-pulse"
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800" />
                <div className="flex-1">
                  <div className="h-6 bg-zinc-800 rounded mb-2 w-32" />
                  <div className="h-4 bg-zinc-800 rounded w-48" />
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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
          >
            ←
          </button>
          <div>
            <p className="text-sm text-zinc-500 mb-1">Seçilen Sınıf</p>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>{grade.icon}</span>
              {grade.name}
            </h2>
          </div>
        </div>

        <div className="text-center">
          <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 mb-4">Dersler yüklenirken bir hata oluştu:</p>
            <p className="text-zinc-400">{error}</p>
            <button
              onClick={onBack}
              className="mt-6 px-6 py-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-all"
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-all"
        >
          ←
        </button>
        <div>
          <p className="text-sm text-zinc-500 mb-1">Seçilen Sınıf</p>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{grade.icon}</span>
            {grade.name}
          </h2>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Hangi <span className="gradient-text">Derse</span> Çalışmak İstiyorsun?
        </h1>
        <p className="text-zinc-400">Dersini seçerek üniteleri görüntüle</p>
      </div>

      {lessons.length === 0 ? (
        <div className="text-center p-8 rounded-2xl bg-zinc-900/50 border border-white/5">
          <p className="text-zinc-400">Bu sınıf için henüz ders bulunmamaktadır.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              onClick={() => onSelect(lesson)}
              className="group p-6 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/20 transition-all duration-300 card-hover text-left flex items-center gap-5"
            >
              {/* Icon */}
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${lesson.color} flex items-center justify-center text-3xl shadow-lg`}>
                {lesson.icon}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-300 transition-all">
                  {lesson.name}
                </h3>
                <p className="text-sm text-zinc-500 mb-3">{lesson.description}</p>
                
                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Icon name="book" size={14} />
                    {lesson.unitCount} Ünite
                  </span>
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Icon name="check-circle" size={14} />
                    {lesson.questionCount} Soru
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                <span className="text-white">→</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
