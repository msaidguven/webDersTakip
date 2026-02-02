'use client';

import React from 'react';
import Link from 'next/link';
import { useHomeViewModel } from './src/viewmodels/useHomeViewModel';
import { GradeSelector } from './src/components/home/GradeSelector';
import { LessonSelector } from './src/components/home/LessonSelector';
import { UnitSelector } from './src/components/home/UnitSelector';
import { TopicSelector } from './src/components/home/TopicSelector';
import { TestConfirm } from './src/components/home/TestConfirm';

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
    <div className="min-h-screen bg-background bg-grid">
      {/* Glow Effects */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-background/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 sm:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-xl font-bold text-white">📚</span>
            </div>
            <span className="text-xl font-bold text-white">Ders Takip</span>
          </Link>

          {/* Right Side */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link 
              href="/panel" 
              className="text-zinc-400 hover:text-white transition-colors hidden sm:block"
            >
              Giriş Yap
            </Link>
            <Link 
              href="/panel"
              className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 transition-all text-sm sm:text-base"
            >
              <span className="sm:hidden">Panel</span>
              <span className="hidden sm:inline">Panele Git</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-[100px] sm:pt-[120px] pb-20 px-4 sm:px-8">
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
                          ? 'text-zinc-400' 
                          : 'text-zinc-600'
                      }
                    `}>
                      <span className={`
                        w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs
                        ${isActive 
                          ? 'bg-indigo-500 text-white' 
                          : isPast 
                            ? 'bg-zinc-800 text-zinc-400' 
                            : 'bg-zinc-900 text-zinc-600'
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
      <footer className="border-t border-white/5 py-6 sm:py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-left">
          <p className="text-zinc-500 text-sm">
            © 2026 Ders Takip. Tüm hakları saklıdır.
          </p>
          <div className="flex gap-6 text-sm text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Hakkımızda</a>
            <a href="#" className="hover:text-white transition-colors">İletişim</a>
            <a href="#" className="hover:text-white transition-colors">Gizlilik</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
