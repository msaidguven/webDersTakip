'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { GradeSelector } from './src/components/home/GradeSelector';
import { LessonSelector } from './src/components/home/LessonSelector';
import { Grade } from './src/models/homeTypes';

const CURRENT_WEEK = 19;

const fetcher = async (): Promise<Grade[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active')
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  
  if (error) throw error;
  
  // Map database fields to Grade type
  return (data || []).map((g: any) => ({
    id: g.id.toString(),
    level: g.order_no,
    name: g.name,
    description: getGradeDescription(g.order_no),
    icon: getGradeIcon(g.order_no),
    color: getGradeColor(g.order_no),
  }));
};

function getGradeDescription(level: number): string {
  const descriptions: Record<number, string> = {
    6: 'Ortaokul 1. seviye',
    7: 'Ortaokul 2. seviye',
    8: 'Ortaokul 3. seviye - LGS',
    9: 'Lise 1. sınıf',
    10: 'Lise 2. sınıf',
    11: 'Lise 3. sınıf - YKS hazırlık',
    12: 'Lise 4. sınıf - YKS',
  };
  return descriptions[level] || `${level}. Sınıf`;
}

function getGradeIcon(level: number): string {
  const icons: Record<number, string> = {
    6: '📚', 7: '📖', 8: '🎯', 9: '🎓', 10: '🔬', 11: '⚡', 12: '🚀',
  };
  return icons[level] || '📖';
}

function getGradeColor(level: number): string {
  const colors: Record<number, string> = {
    6: 'from-emerald-500 to-teal-500',
    7: 'from-cyan-500 to-blue-500',
    8: 'from-blue-500 to-indigo-500',
    9: 'from-indigo-500 to-purple-500',
    10: 'from-purple-500 to-pink-500',
    11: 'from-pink-500 to-rose-500',
    12: 'from-orange-500 to-amber-500',
  };
  return colors[level] || 'from-indigo-500 to-purple-500';
}

interface HomeClientProps {
  initialGrades: any[];
}

export default function HomeClient({ initialGrades }: HomeClientProps) {
  // SWR with fallbackData for stale-while-revalidate pattern
  const { data: grades } = useSWR(
    'grades',
    fetcher,
    {
      fallbackData: initialGrades,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  const [selectedGrade, setSelectedGrade] = useState<any | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);

  const handleGradeSelect = async (grade: any) => {
    setSelectedGrade(grade);
    setLoadingLessons(true);
    
    const supabase = createClient();
    const { data } = await supabase
      .from('lesson_grades')
      .select('lessons(id, name, icon, description)')
      .eq('grade_id', grade.id)
      .eq('is_active', true);
    
    const lessonList = data?.map((item: any) => item.lessons) || [];
    setLessons(lessonList);
    setLoadingLessons(false);
  };

  return (
    <div className="min-h-screen">
      <main className="py-6 sm:py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-6xl mx-auto mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-default">Müfredat Haftası</h2>
              <Link href="#" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-1">
                Takvim <span>→</span>
              </Link>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {[17, 18, 19, 20, 21, 22].map((week) => (
                <button
                  key={week}
                  disabled={week > 21}
                  className={`
                    flex flex-col items-center min-w-[72px] py-3 px-4 rounded-xl transition-all
                    ${week === CURRENT_WEEK 
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30' 
                      : week > 21
                        ? 'bg-surface-elevated text-muted cursor-not-allowed'
                        : 'bg-surface-elevated text-muted hover:bg-surface hover:text-default border border-default'
                    }
                  `}
                >
                  <span className="text-2xl font-bold">{week}</span>
                  <span className="text-xs mt-1">
                    {week === CURRENT_WEEK ? 'Şimdi' : week < CURRENT_WEEK ? 'Geçen' : week > 21 ? 'Kilitli' : 'Gelecek'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {!selectedGrade ? (
            <GradeSelector 
              grades={grades || []}
              isLoading={!grades}
              onSelect={handleGradeSelect} 
            />
          ) : (
            <LessonSelector
              grade={selectedGrade}
              lessons={lessons}
              isLoading={loadingLessons}
              onSelect={(lesson: any) => {
                window.location.href = `/ders?grade_id=${selectedGrade.id}&lesson_id=${lesson.id}`;
              }}
              onBack={() => {
                setSelectedGrade(null);
                setLessons([]);
              }}
            />
          )}
        </div>
      </main>

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
