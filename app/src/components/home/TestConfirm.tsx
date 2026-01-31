'use client';

import React from 'react';
import Link from 'next/link';
import { Grade, Lesson, Unit, Topic } from '../../models/homeTypes';
import { Icon } from '../icons';

interface TestConfirmProps {
  grade: Grade;
  lesson: Lesson;
  unit: Unit;
  topics: Topic[];
  totalQuestions: number;
  totalTime: number;
  onBack: () => void;
}

export function TestConfirm({ 
  grade, 
  lesson, 
  unit, 
  topics, 
  totalQuestions, 
  totalTime,
  onBack 
}: TestConfirmProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white mb-4">
          Test <span className="gradient-text">Hazır</span>! 🚀
        </h1>
        <p className="text-zinc-400 text-lg">
          Seçimlerini gözden geçir ve teste başla
        </p>
      </div>

      {/* Summary Card */}
      <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-8 mb-6">
        <h2 className="text-xl font-semibold text-white mb-6">Seçimlerin</h2>
        
        <div className="space-y-4">
          {/* Grade */}
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">Sınıf:</span>
              <span className="text-2xl">{grade.icon}</span>
              <span className="font-medium text-white">{grade.name}</span>
            </div>
          </div>

          {/* Lesson */}
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">Ders:</span>
              <span className="text-2xl">{lesson.icon}</span>
              <span className="font-medium text-white">{lesson.name}</span>
            </div>
          </div>

          {/* Unit */}
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">Ünite:</span>
              <span className="font-medium text-white">{unit.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Topics Card */}
      <div className="rounded-2xl bg-zinc-900/50 border border-white/5 p-8 mb-6">
        <h2 className="text-xl font-semibold text-white mb-6">
          Konular ({topics.length})
        </h2>
        
        <div className="space-y-3">
          {topics.map((topic) => (
            <div 
              key={topic.id}
              className="flex items-center justify-between py-3 px-4 rounded-xl bg-zinc-800/50"
            >
              <span className="text-white">{topic.name}</span>
              <div className="flex items-center gap-4 text-sm text-zinc-500">
                <span className="flex items-center gap-1">
                  <Icon name="check-circle" size={14} />
                  {topic.questionCount} soru
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="clock" size={14} />
                  ~{topic.estimatedTime} dk
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Card */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 p-6 text-center">
          <Icon name="check-circle" size={32} className="text-indigo-400 mx-auto mb-2" />
          <p className="text-3xl font-bold text-white">{totalQuestions}</p>
          <p className="text-zinc-400">Toplam Soru</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 p-6 text-center">
          <Icon name="clock" size={32} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-3xl font-bold text-white">~{totalTime}</p>
          <p className="text-zinc-400">Tahmini Süre (dk)</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-4 rounded-xl bg-zinc-900/50 border border-white/10 text-zinc-400 font-medium hover:text-white hover:border-white/20 transition-all"
        >
          ← Geri Dön
        </button>
        <Link
          href="/test"
          className="flex-[2] flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
        >
          <span>Teste Başla</span>
          <span className="text-xl">→</span>
        </Link>
      </div>
    </div>
  );
}
