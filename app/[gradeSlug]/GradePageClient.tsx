'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { LessonSelector } from '../src/components/home/LessonSelector';
import { Grade, Lesson } from '../src/models/homeTypes';
import { getGradeColor, getGradeDescription, getGradeIcon } from '../src/lib/homeMapping';

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

type LessonGradeRow = { lesson_id: number };
type LessonRow = {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  slug: string | null;
  order_no: number | null;
  question_count?: number | null;
};

interface GradePageClientProps {
  gradeSlug: string;
  initialGrade?: Grade | null;
  initialLessons?: Lesson[];
}

export default function GradePageClient({ gradeSlug, initialGrade = null, initialLessons = [] }: GradePageClientProps) {
  const router = useRouter();
  const [grade, setGrade] = useState<Grade | null>(initialGrade);
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const [loading, setLoading] = useState(!initialGrade);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialGrade) {
      return;
    }

    const supabase = createClient();
    
    async function load() {
      // Grade slug ile bul
      const { data: gradeData, error: gradeError } = await supabase
        .from('grades')
        .select('id, name, order_no, slug')
        .eq('slug', gradeSlug)
        .single();

      if (gradeError || !gradeData) {
        console.log('Grade hatası:', gradeError);
        setError('Sınıf bulunamadı');
        setLoading(false);
        return;
      }

      const formattedGrade: Grade = {
        id: gradeData.id.toString(),
        level: gradeData.order_no,
        name: gradeData.name,
        slug: gradeData.slug || `${gradeData.order_no}-sinif`,
        description: getGradeDescription(gradeData.order_no),
        icon: getGradeIcon(gradeData.order_no),
        color: getGradeColor(gradeData.order_no),
      };

      setGrade(formattedGrade);

      // Dersleri çek
      const { data: lgData } = await supabase
        .from('lesson_grades')
        .select('lesson_id')
        .eq('grade_id', gradeData.id)
        .eq('is_active', true);

      const ids = ((lgData as LessonGradeRow[] | null) || []).map((x) => x.lesson_id);
      
      if (ids.length > 0) {
        const { data: dersler, error: lessonError } = await supabase
          .from('lessons')
          .select('id, name, icon, description, slug, order_no')
          .in('id', ids)
          .eq('is_active', true)
          .order('order_no');
        
        if (lessonError) {
          setError('Dersler yüklenemedi');
        } else {
          const transformed: Lesson[] = ((dersler as LessonRow[] | null) || []).map((l) => ({
            id: String(l.id),
            gradeId: formattedGrade.id,
            name: l.name,
            description: l.description || '',
            icon: l.icon || '📘',
            color: getLessonColor(l.order_no ?? 0),
            unitCount: 0,
            questionCount: l.question_count ?? 0,
            slug: l.slug,
          }));
          setLessons(transformed);
        }
      }
      
      setLoading(false);
    }

    load();
  }, [gradeSlug, initialGrade, initialLessons]);

  if (loading) return <div className="p-8 text-center text-muted">Yükleniyor...</div>;
  if (!grade) return <div className="p-8 text-center text-red-500">{error || 'Sınıf bulunamadı'}</div>;

  return (
    <div className="min-h-screen py-6 sm:py-8">
      <LessonSelector
        grade={grade}
        lessons={lessons}
        isLoading={loading}
        error={error}
        onSelect={() => {}}
        onBack={() => router.push('/')}
      />
    </div>
  );
}
