'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Grade } from '@/app/src/models/homeTypes';
import { getGradeColor, getGradeDescription, getGradeIcon, getLessonColor } from '@/app/src/lib/homeMapping';
import { useRouter } from 'next/navigation';

interface Lesson {
  id: string;
  name: string;
  slug: string | null;
  icon: string | null;
  description: string | null;
  color: string;
}

interface Props {
  gradeSlug: string;
}

export default function GradePageClient({ gradeSlug }: Props) {
  const router = useRouter();
  const [grade, setGrade] = useState<Grade | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      // Grade'i çek
      const { data: gradeData, error: gradeError } = await supabase
        .from('grades')
        .select('id, name, order_no')
        .eq('slug', gradeSlug)
        .single();

      if (gradeError || !gradeData) {
        setError('Sınıf bulunamadı');
        setLoading(false);
        return;
      }

      const gradeInfo: Grade = {
        id: gradeData.id.toString(),
        level: gradeData.order_no,
        name: gradeData.name,
        description: getGradeDescription(gradeData.order_no),
        icon: getGradeIcon(gradeData.order_no),
        color: getGradeColor(gradeData.order_no),
        slug: gradeSlug,
      };
      setGrade(gradeInfo);

      // Dersleri çek
      const { data: lessonGradesData } = await supabase
        .from('lesson_grades')
        .select('lesson_id')
        .eq('grade_id', gradeData.id)
        .eq('is_active', true);

      const lessonIds = lessonGradesData?.map(lg => lg.lesson_id) || [];
      
      if (lessonIds.length > 0) {
        const { data: lessonsData } = await supabase
          .from('lessons')
          .select('id, name, icon, description, slug, order_no')
          .in('id', lessonIds)
          .eq('is_active', true)
          .order('order_no');
        
        const lessonsList = (lessonsData || []).map((lesson, index) => ({
          id: lesson.id.toString(),
          name: lesson.name,
          slug: lesson.slug,
          icon: lesson.icon || '📘',
          description: lesson.description || '',
          color: getLessonColor(lesson.order_no ?? index),
        }));
        
        setLessons(lessonsList);
      }
      
      setLoading(false);
    }

    fetchData();
  }, [gradeSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !grade) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Bir hata oluştu'}</p>
          <Link href="/" className="text-indigo-600 hover:underline">Anasayfaya Dön</Link>
        </div>
      </div>
    );
  }

  const handleLessonClick = (lesson: Lesson) => {
    const lessonSlug = lesson.slug || lesson.id;
    router.push(`/${gradeSlug}/${lessonSlug}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{grade.icon}</span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{grade.name}</h1>
              <p className="text-indigo-100 text-sm">{grade.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-default">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link href="/" className="hover:text-default transition-colors">Anasayfa</Link>
            <span>/</span>
            <span className="text-default font-medium">{grade.name}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold text-default mb-6">Dersleri Seç</h2>
        
        {lessons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted">Bu sınıfta henüz ders bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => handleLessonClick(lesson)}
                className="group text-left bg-surface-elevated hover:bg-surface border border-default hover:border-indigo-300 rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: lesson.color + '20' }}
                  >
                    {lesson.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-default group-hover:text-indigo-600 transition-colors truncate">
                      {lesson.name}
                    </h3>
                    <p className="text-sm text-muted mt-1 line-clamp-2">
                      {lesson.description || 'Üniteleri görüntüle'}
                    </p>
                  </div>
                  <svg 
                    className="w-5 h-5 text-muted group-hover:text-indigo-500 transition-colors flex-shrink-0 mt-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-default transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Tüm Sınıflara Dön
          </Link>
        </div>
      </main>
    </div>
  );
}
