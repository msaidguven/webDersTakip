'use client';

import Link from 'next/link';
import { FileText, ChevronRight, Home, GraduationCap, BookOpen } from 'lucide-react';

interface Topic {
  id: number;
  title: string;
  slug: string;
  order_no: number;
  question_count: number;
}

interface Unit {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  lesson_id: number;
}

interface Lesson {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}

interface Grade {
  id: number;
  name: string;
  slug: string;
}

interface UnitTopicsClientProps {
  grade: Grade;
  lesson: Lesson;
  unit: Unit;
  topics: Topic[];
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

export default function UnitTopicsClient({ 
  grade, 
  lesson, 
  unit, 
  topics, 
  gradeSlug, 
  lessonSlug,
  unitSlug
}: UnitTopicsClientProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <span className="text-2xl">{lesson.icon || '📘'}</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{unit.title}</h1>
              <p className="text-indigo-100 text-sm">{grade.name} • {lesson.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-default">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted flex-wrap">
            <Link href="/" className="hover:text-default transition-colors flex items-center gap-1">
              <Home className="w-4 h-4" />
              Anasayfa
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${gradeSlug}`} className="hover:text-default transition-colors">
              {grade.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${gradeSlug}/${lessonSlug}`} className="hover:text-default transition-colors">
              {lesson.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-default font-medium">{unit.title}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {unit.description && (
          <p className="text-muted mb-6 bg-surface-elevated p-4 rounded-xl border border-default">
            {unit.description}
          </p>
        )}

        <h2 className="text-xl font-semibold text-default mb-6 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Konular
        </h2>
        
        {topics.length === 0 ? (
          <div className="text-center py-12 bg-surface-elevated rounded-xl border border-default">
            <p className="text-muted">Bu ünitede henüz konu bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topics.map((topic, index) => (
              <Link
                key={topic.id}
                href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug}`}
                className="group block bg-surface-elevated hover:bg-surface border border-default hover:border-indigo-300 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-default group-hover:text-indigo-600 transition-colors">
                      {topic.title}
                    </h3>
                    {topic.question_count > 0 && (
                      <p className="text-xs text-muted mt-2">
                        {topic.question_count} soru
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-2" />
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link 
            href={`/${gradeSlug}/${lessonSlug}`}
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-default transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            {lesson.name} Ünitelerine Dön
          </Link>
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
