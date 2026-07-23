'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';
import { useRouter } from 'next/navigation';
import { GradeSelector } from './src/components/home/GradeSelector';
import { LessonSelector } from './src/components/home/LessonSelector';
import { Grade, Lesson } from './src/models/homeTypes';
import {
  getGradeColor,
  getGradeDescription,
  getGradeIcon,
} from './src/lib/homeMapping';

interface GradeRow {
  id: number;
  name: string;
  order_no: number;
  is_active: boolean;
  slug: string;
}

const fetcher = async (): Promise<Grade[]> => {
  logger.log('[HomeClient fetcher] Siniflar cekiliyor...');
  const supabase = createClient();
  
  // DB şeması: grades(id, name, order_no, is_active, question_count, slug)
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active, slug')
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  
  if (error) {
    logger.error('[HomeClient fetcher] HATA:', error);
    throw error;
  }
  
  logger.log('[HomeClient fetcher] Bulunan kayit:', data?.length || 0);
  
  // DB'de olmayan alanları client-side ekle
  const gradeRows = (data as GradeRow[] | null) || [];
  const grades = gradeRows.map((g) => ({
    id: g.id.toString(),
    level: g.order_no,
    name: g.name,
    slug: g.slug || `${g.order_no}-sinif`,
    description: getGradeDescription(g.order_no),
    icon: getGradeIcon(g.order_no),
    color: getGradeColor(g.order_no),
  }));
  
  logger.log('[HomeClient fetcher] SONUC:', grades);
  return grades;
};

interface HomeClientProps {
  initialGrades: Grade[];
}

interface LessonRow {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  order_no: number | null;
  slug: string | null;
  question_count?: number | null;
}

function getLessonColor(orderNo: number): string {
  const colors = [
    'from-indigo-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-orange-500 to-amber-500',
    'from-blue-500 to-cyan-500',
    'from-pink-500 to-rose-500',
  ];
  return colors[Math.abs(orderNo) % colors.length];
}

function getCurrentAcademicWeekNo() {
  // Geçici: 1. hafta başlangıcı 8 Eylül 2025 (sonra DB’den dinamik yapılacak)
  const week1Start = new Date(2025, 8, 8);

  const now = new Date();
  const start = new Date(week1Start.getFullYear(), week1Start.getMonth(), week1Start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  if (!Number.isFinite(week)) return 1;
  return Math.max(1, week);
}

export default function HomeClient({ initialGrades }: HomeClientProps) {
  const router = useRouter();
  const { data: grades, error } = useSWR(
    'grades',
    fetcher,
    {
      fallbackData: initialGrades,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  );

  const [step, setStep] = useState<'grade' | 'lesson'>('grade');
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [lessonsError, setLessonsError] = useState<string | null>(null);

  const currentWeekNo = useMemo(() => {
    // UI’da 1..30 gösteriyoruz, o yüzden şimdilik 30’a clamp’liyoruz
    return Math.min(30, getCurrentAcademicWeekNo());
  }, []);

  const handleGradeSelect = async (grade: Grade) => {
    logger.log('[HomeClient] Grade secildi:', grade);
    setSelectedGrade(grade);
    setStep('lesson');
    setLessons([]);
    setLessonsError(null);
    setIsLoadingLessons(true);

    try {
      const supabase = createClient();

      // grade -> lesson ilişkisi: lesson_grades(lesson_id, grade_id, is_active)
      const { data: lgData, error: lgError } = await supabase
        .from('lesson_grades')
        .select('lesson_id')
        .eq('grade_id', parseInt(grade.id, 10))
        .eq('is_active', true);

      if (lgError) throw lgError;

      const ids = ((lgData as { lesson_id: number }[] | null) || []).map((x) => x.lesson_id);

      if (!ids.length) {
        setLessons([]);
        return;
      }

      const { data: dersler, error: dersError } = await supabase
        .from('lessons')
        .select('id, name, icon, description, slug, order_no')
        .in('id', ids)
        .eq('is_active', true)
        .order('order_no', { ascending: true });

      if (dersError) throw dersError;

      const transformed: Lesson[] = ((dersler as LessonRow[] | null) || []).map((l) => ({
        id: String(l.id),
        gradeId: grade.id,
        name: l.name,
        description: l.description || '',
        icon: l.icon || '📘',
        color: getLessonColor(l.order_no ?? 0),
        unitCount: 0,
        questionCount: l.question_count ?? 0,
        slug: l.slug,
      }));

      setLessons(transformed);
    } catch (e: unknown) {
      logger.error('[HomeClient] Dersler cekilemedi:', e);
      setLessonsError('Dersler yüklenirken bir hata oluştu.');
    } finally {
      setIsLoadingLessons(false);
    }
  };

  const handleLessonSelect = (lesson: Lesson) => {
    // /ders sayfası: sinif + ders + hafta
    const dersParam = lesson.slug || lesson.id;
    const url = `/ders?sinif=${selectedGrade?.id}&ders=${dersParam}&hafta=${currentWeekNo}`;
    logger.log('[HomeClient] Ders secildi, yonlendiriliyor:', url);
    router.push(url);
  };

  const handleBackToGrades = () => {
    setStep('grade');
    setSelectedGrade(null);
    setLessons([]);
    setLessonsError(null);
    setIsLoadingLessons(false);
  };

  return (
    <div className="min-h-screen">
      <main className="py-6 sm:py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          {step === 'grade' ? (
            <GradeSelector
              grades={grades || []}
              isLoading={!grades}
              error={error?.message}
              onSelect={handleGradeSelect}
            />
          ) : selectedGrade ? (
            <LessonSelector
              grade={selectedGrade}
              lessons={lessons}
              isLoading={isLoadingLessons}
              error={lessonsError}
              onSelect={handleLessonSelect}
              onBack={handleBackToGrades}
            />
          ) : null}
        </div>
      </main>

      <footer className="border-t border-default py-6 sm:py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-left">
          <p className="text-muted text-sm">
            © 2026 Ders Takip. Tum haklari saklidir.
          </p>
          <div className="flex gap-6 text-sm text-muted">
            <a href="#" className="hover:text-default transition-colors">Hakkimizda</a>
            <a href="#" className="hover:text-default transition-colors">Iletisim</a>
            <a href="#" className="hover:text-default transition-colors">Gizlilik</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
