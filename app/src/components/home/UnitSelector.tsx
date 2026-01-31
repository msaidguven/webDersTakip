'use client';

import React from 'react';
import { Lesson, Unit } from '../../models/homeTypes';
import { Icon } from '../icons';

interface UnitSelectorProps {
  lesson: Lesson;
  units: Unit[];
  onSelect: (unit: Unit) => void;
  onBack: () => void;
}

export function UnitSelector({ lesson, units, onSelect, onBack }: UnitSelectorProps) {
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
          <p className="text-sm text-zinc-500 mb-1">Seçilen Ders</p>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>{lesson.icon}</span>
            {lesson.name}
          </h2>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Hangi <span className="gradient-text">Ünite</span>yi Çalışmak İstiyorsun?
        </h1>
        <p className="text-zinc-400">Üniteyi seçerek konuları görüntüle</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {units.map((unit, index) => (
          <button
            key={unit.id}
            onClick={() => onSelect(unit)}
            className="group p-6 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-white/20 transition-all duration-300 card-hover text-left"
          >
            <div className="flex items-start gap-4">
              {/* Unit Number */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-xl font-bold text-indigo-400">
                {unit.order}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                  {unit.name}
                </h3>
                <p className="text-sm text-zinc-500 mb-3">{unit.description}</p>
                
                {/* Topics Preview */}
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Icon name="book" size={14} />
                  <span>{unit.topicCount} Konu</span>
                </div>

                {/* Topic Names Preview */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {unit.topics.slice(0, 3).map((topic) => (
                    <span 
                      key={topic.id}
                      className="px-2 py-1 text-xs bg-zinc-800 text-zinc-400 rounded-lg"
                    >
                      {topic.name}
                    </span>
                  ))}
                  {unit.topics.length > 3 && (
                    <span className="px-2 py-1 text-xs bg-zinc-800 text-zinc-500 rounded-lg">
                      +{unit.topics.length - 3}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                <span className="text-white">→</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
