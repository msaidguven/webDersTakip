'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Lesson {
  id: string;
  name: string;
  slug: string | null;
  icon: string | null;
}

interface GradeInfo {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  gradeSlug: string;
}

export default function GradePageClient({ gradeSlug }: Props) {
  const router = useRouter();
  const [grade, setGrade] = useState<GradeInfo | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        
        // Önce grade ID'sini bul
        const { data: gradeData, error: gradeError } = await supabase
          .from('grades')
          .select('id, name, slug')
          .or(`slug.eq.${gradeSlug},id.eq.${gradeSlug.replace('-sinif', '')}`)
          .single();

        if (gradeError || !gradeData) {
          setError('Sınıf bulunamadı');
          setLoading(false);
          return;
        }

        setGrade({
          id: gradeData.id.toString(),
          name: gradeData.name,
          slug: gradeData.slug || `${gradeData.id}-sinif`,
        });

        // Bu sınıftaki dersleri çek
        const { data: lessonGradesData } = await supabase
          .from('lesson_grades')
          .select('lesson_id')
          .eq('grade_id', gradeData.id)
          .eq('is_active', true);

        const lessonIds = lessonGradesData?.map((lg: any) => lg.lesson_id) || [];
        
        if (lessonIds.length > 0) {
          const { data: lessonsData } = await supabase
            .from('lessons')
            .select('id, name, icon, slug')
            .in('id', lessonIds)
            .eq('is_active', true)
            .order('order_no');
          
          const lessonsList = (lessonsData || []).map((lesson: any) => ({
            id: lesson.id.toString(),
            name: lesson.name,
            slug: lesson.slug || lesson.id.toString(),
            icon: lesson.icon || '📘',
          }));
          
          setLessons(lessonsList);
        }
        
        setLoading(false);
      } catch (err) {
        setError('Veri yüklenirken hata oluştu');
        setLoading(false);
      }
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <h1 className="text-2xl sm:text-3xl font-bold">{grade.name}</h1>
          <p className="text-indigo-100 text-sm">Dersleri Seç</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-default">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link href="/" className="hover:text-default">Anasayfa</Link>
            <span>/</span>
            <span className="text-default">{grade.name}</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">Dersler</h2>
        
        {lessons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted">Bu sınıfta henüz ders bulunmuyor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/${gradeSlug}/${lesson.slug}`}
                className="block bg-surface-elevated border border-default rounded-xl p-5 hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{lesson.icon}</span>
                  <h3 className="font-semibold">{lesson.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8">
          <Link href="/" className="text-indigo-600 hover:underline">← Tüm Sınıflara Dön</Link>
        </div>
      </main>
    </div>
  );
}
