'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight, Home, GraduationCap } from 'lucide-react';

interface Unit {
  id: number;
  title: string;
  slug: string | null;
  description: string | null;
  order_no: number;
  question_count: number;
}

interface Lesson {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
}

interface Grade {
  id: number;
  name: string;
  slug: string;
  order_no: number;
}

interface LessonUnitsClientProps {
  grade: Grade;
  lesson: Lesson;
  units: Unit[];
  gradeSlug: string;
  lessonSlug: string;
}

export default function LessonUnitsClient({ 
  grade, 
  lesson, 
  units, 
  gradeSlug, 
  lessonSlug 
}: LessonUnitsClientProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{lesson.icon || '📘'}</span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{lesson.name}</h1>
              <p className="text-indigo-100 text-sm">{grade.name} • Üniteler</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-default">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link href="/" className="hover:text-default transition-colors flex items-center gap-1">
              <Home className="w-4 h-4" />
              Anasayfa
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${gradeSlug}`} className="hover:text-default transition-colors">
              {grade.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-default font-medium">{lesson.name}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold text-default mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Üniteler
        </h2>
        
        {units.length === 0 ? (
          <div className="text-center py-12 bg-surface-elevated rounded-xl border border-default">
            <p className="text-muted">Bu derste henüz ünite bulunmuyor.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {units.map((unit, index) => {
              const unitSlug = unit.slug || `unite-${unit.id}`;
              return (
                <Link
                  key={unit.id}
                  href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}
                  className="group block bg-surface-elevated hover:bg-surface border border-default hover:border-indigo-300 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-default group-hover:text-indigo-600 transition-colors">
                        {unit.title}
                      </h3>
                      {unit.description && (
                        <p className="text-sm text-muted mt-1 line-clamp-1">
                          {unit.description}
                        </p>
                      )}
                      {unit.question_count > 0 && (
                        <p className="text-xs text-muted mt-2">
                          {unit.question_count} soru
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center gap-4">
          <Link 
            href={`/${gradeSlug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-default transition-colors"
          >
            <GraduationCap className="w-4 h-4" />
            {grade.name} Derslerine Dön
          </Link>
        </div>
      </main>
    </div>
  );
}
