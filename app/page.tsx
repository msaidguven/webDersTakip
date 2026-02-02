'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useHomeViewModel } from './src/viewmodels/useHomeViewModel';
import { GradeSelector } from './src/components/home/GradeSelector';
import { LessonSelector } from './src/components/home/LessonSelector';
import { UnitSelector } from './src/components/home/UnitSelector';
import { TopicSelector } from './src/components/home/TopicSelector';
import { TestConfirm } from './src/components/home/TestConfirm';

// Hafta Seçici Komponenti
function WeekSelector() {
  const [currentWeek, setCurrentWeek] = useState(19);
  const weeks = [
    { number: 17, label: 'Geçen' },
    { number: 18, label: 'Geçen' },
    { number: 19, label: 'Şimdi', active: true },
    { number: 20, label: 'Gelecek' },
    { number: 21, label: 'Gelecek' },
    { number: 22, label: 'Kilitli', locked: true },
  ];

  return (
    <div className="max-w-6xl mx-auto mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-default">Müfredat Haftası</h2>
        <Link href="#" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
          Takvim <span>→</span>
        </Link>
      </div>

      {/* Week Scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {weeks.map((week) => (
          <button
            key={week.number}
            onClick={() => !week.locked && setCurrentWeek(week.number)}
            disabled={week.locked}
            className={`
              flex flex-col items-center min-w-[72px] py-3 px-4 rounded-xl transition-all
                ${week.active 
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-default shadow-lg shadow-indigo-500/30' 
                 : week.locked
                   ? 'bg-surface-elevated text-muted cursor-not-allowed'
                   : 'bg-surface-elevated text-muted hover:bg-zinc-800 hover:text-default'
              }
            `}
          >
                            <h2 className="text-lg font-semibold text-default">Üniteler</h2>
            <span className="text-2xl font-bold">{week.number}</span>
            <span className="text-xs mt-1">{week.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const {
    grades,
    availableLessons,
    availableUnits,
    selection,
    isLoadingGrades,
    isLoadingLessons,
    gradesError,
    lessonsError,
    totalQuestions,
    totalTime,
    selectGrade,
    selectLesson,
    selectUnit,
    toggleTopic,
    selectAllTopics,
    clearTopics,
    goBack,
    goToConfirm,
  } = useHomeViewModel();

  return (
    <div className="min-h-screen">
      {/* Main Content */}
      <main className="py-6 sm:py-8 px-4 sm:px-8">
        {/* Week Selector - Ana sayfada her zaman göster */}
        {selection.step === 'grade' && <WeekSelector />}

        {/* Progress Steps */}
        {selection.step !== 'grade' && (
          <div className="max-w-6xl mx-auto mb-8 sm:mb-12">
            <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
              {['grade', 'lesson', 'unit', 'topic', 'confirm'].map((step, index) => {
                const stepNames = ['Sınıf', 'Ders', 'Ünite', 'Konu', 'Onay'];
                const isActive = selection.step === step;
                const isPast = 
                  (step === 'grade') ||
                  (step === 'lesson' && selection.selectedGrade) ||
                  (step === 'unit' && selection.selectedLesson) ||
                  (step === 'topic' && selection.selectedUnit) ||
                  (step === 'confirm' && selection.selectedTopics.length > 0);

                return (
                  <React.Fragment key={step}>
                    <div className={`
                      flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all
                      ${isActive 
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                        : isPast 
                            ? 'text-muted' 
                          : 'text-muted'
                      }
                    `}>
                      <span className={`
                        w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs
                        ${isActive 
                          ? 'bg-indigo-500 text-default' 
                          : isPast 
                            ? 'bg-zinc-800 text-muted' 
                              : 'bg-surface-elevated text-muted'
                        }
                      `}>
                        {index + 1}
                      </span>
                      <span className="hidden sm:inline">{stepNames[index]}</span>
                    </div>
                    {index < 4 && (
                      <div className={`w-4 sm:w-8 h-px ${isPast ? 'bg-zinc-700' : 'bg-zinc-800'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Step Content */}
        {selection.step === 'grade' && (
          <GradeSelector 
            grades={grades}
            isLoading={isLoadingGrades}
            error={gradesError}
            onSelect={selectGrade} 
          />
        )}

        {selection.step === 'lesson' && selection.selectedGrade && (
          <LessonSelector
            grade={selection.selectedGrade}
            lessons={availableLessons}
            isLoading={isLoadingLessons}
            error={lessonsError}
            onSelect={selectLesson}
            onBack={goBack}
          />
        )}

        {selection.step === 'unit' && selection.selectedLesson && (
          <UnitSelector
            lesson={selection.selectedLesson}
            units={availableUnits}
            onSelect={selectUnit}
            onBack={goBack}
          />
        )}

        {selection.step === 'topic' && selection.selectedUnit && (
          <TopicSelector
            unit={selection.selectedUnit}
            selectedTopics={selection.selectedTopics}
            onToggleTopic={toggleTopic}
            onSelectAll={selectAllTopics}
            onClear={clearTopics}
            onContinue={goToConfirm}
            onBack={goBack}
          />
        )}

        {selection.step === 'confirm' && 
         selection.selectedGrade && 
         selection.selectedLesson && 
         selection.selectedUnit && (
          <TestConfirm
            grade={selection.selectedGrade}
            lesson={selection.selectedLesson}
            unit={selection.selectedUnit}
            topics={selection.selectedTopics}
            totalQuestions={totalQuestions}
            totalTime={totalTime}
            onBack={goBack}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-default py-6 sm:py-8 px-4 sm:px-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-left">
          <p className="text-muted text-sm">
            © 2026 Ders Takip. Tüm hakları saklıdır.
          </p>
          <div className="flex gap-6 text-sm text-muted">
            <a href="#" className="hover:text-default transition-colors">Hakkımızda</a>
            <a href="#" className="hover:text-default transition-colors">İletişim</a>
            <a href="#" className="hover:text-default transition-colors">Gizlilik</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
