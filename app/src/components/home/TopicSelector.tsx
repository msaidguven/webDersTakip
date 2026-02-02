'use client';

import React from 'react';
import { Unit, Topic } from '../../models/homeTypes';
import { Icon } from '../icons';

interface TopicSelectorProps {
  unit: Unit;
  selectedTopics: Topic[];
  onToggleTopic: (topic: Topic) => void;
  onSelectAll: (topics: Topic[]) => void;
  onClear: () => void;
  onContinue: () => void;
  onBack: () => void;
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'medium':
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'hard':
      return 'text-red-400 bg-red-500/10 border-red-500/20';
    default:
      return 'text-muted bg-zinc-800';
  }
}

function getDifficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'Kolay';
    case 'medium':
      return 'Orta';
    case 'hard':
      return 'Zor';
    default:
      return difficulty;
  }
}

export function TopicSelector({ 
  unit, 
  selectedTopics, 
  onToggleTopic, 
  onSelectAll, 
  onClear,
  onContinue,
  onBack 
}: TopicSelectorProps) {
  const allSelected = selectedTopics.length === unit.topics.length && unit.topics.length > 0;
  const totalQuestions = selectedTopics.reduce((sum, t) => sum + t.questionCount, 0);
  const totalTime = selectedTopics.reduce((sum, t) => sum + t.estimatedTime, 0);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-surface-elevated border border-default flex items-center justify-center text-muted hover:text-default hover:border-default/20 transition-all"
        >
          ←
        </button>
        <div>
          <p className="text-sm text-muted mb-1">Seçilen Ünite</p>
          <h2 className="text-xl font-bold text-default">{unit.name}</h2>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-default mb-2">
          Hangi <span className="gradient-text">Konuları</span> Çalışmak İstiyorsun?
        </h1>
        <p className="text-muted">Konuları seç ve teste başla</p>
      </div>

      {/* Select All / Clear */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => allSelected ? onClear() : onSelectAll(unit.topics)}
          className="px-4 py-2 rounded-xl bg-surface-elevated border border-default text-sm text-muted hover:text-default hover:border-default/20 transition-all"
        >
          {allSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'}
        </button>
        {selectedTopics.length > 0 && (
          <button
            onClick={onClear}
            className="px-4 py-2 rounded-xl bg-surface-elevated border border-default text-sm text-muted hover:text-red-400 hover:border-red-500/20 transition-all"
          >
            Temizle
          </button>
        )}
      </div>

      {/* Topics List */}
      <div className="grid grid-cols-1 gap-3 mb-8">
        {unit.topics.map((topic) => {
          const isSelected = selectedTopics.some(t => t.id === topic.id);
          
          return (
            <button
              key={topic.id}
              onClick={() => onToggleTopic(topic)}
              className={`
                group p-5 rounded-2xl border transition-all duration-200 text-left
                ${isSelected 
                  ? 'bg-indigo-500/10 border-indigo-500/50' 
                  : 'bg-surface-elevated border-default hover:border-default/20'
                }
              `}
            >
              <div className="flex items-center gap-4">
                {/* Checkbox */}
                <div className={`
                  w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all
                  ${isSelected 
                    ? 'bg-indigo-500 border-indigo-500' 
                    : 'border-zinc-600 group-hover:border-zinc-500'
                  }
                `}>
                  {isSelected && <Icon name="check" size={14} className="text-default" />}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`font-semibold ${isSelected ? 'text-default' : 'text-muted'}`}>
                      {topic.name}
                    </h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${getDifficultyColor(topic.difficulty)}`}>
                      {getDifficultyLabel(topic.difficulty)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{topic.description}</p>
                </div>

                {/* Stats */}
                <div className="text-right text-sm text-muted">
                  <div className="flex items-center gap-1 mb-1">
                    <Icon name="check-circle" size={14} />
                    <span>{topic.questionCount} soru</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="clock" size={14} />
                    <span>~{topic.estimatedTime} dk</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Bar - Summary */}
      {selectedTopics.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0f0f11]/95 backdrop-blur-xl border-t border-default z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-muted">Seçilen Konu</p>
                <p className="text-xl font-bold text-default">{selectedTopics.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Toplam Soru</p>
                <p className="text-xl font-bold text-default">{totalQuestions}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Tahmini Süre</p>
                <p className="text-xl font-bold text-default">~{totalTime} dk</p>
              </div>
            </div>

            <button
              onClick={onContinue}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-default font-semibold rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
            >
              <span>Teste Başla</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
