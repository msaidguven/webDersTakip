'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Home, GraduationCap, BookOpen, ChevronRight } from 'lucide-react';

interface Unit {
  id: number;
  title: string;
  slug: string | null;
  description: string | null;
  order_no: number;
  question_count: number;
}

export default function LessonUnitsPageClient() {
  const router = useRouter();
  const params = useParams();
  const gradeSlug = params.gradeSlug as string;
  const lessonSlug = params.lessonSlug as string;
  
  const [grade, setGrade] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      // Grade ve lesson çek
      const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
        supabase.from('grades').select('*').eq('slug', gradeSlug).single(),
        supabase.from('lessons').select('*').eq('slug', lessonSlug).single(),
      ]);

      if (!gradeData || !lessonData) {
        setLoading(false);
        return;
      }

      setGrade(gradeData);
      setLesson(lessonData);

      // Üniteleri çek
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .eq('lesson_id', lessonData.id)
        .eq('is_active', true)
        .order('order_no');

      // Unit grades kontrolü
      const { data: unitGradesData } = await supabase
        .from('unit_grades')
        .select('unit_id')
        .eq('grade_id', gradeData.id);

      const validUnitIds = new Set(unitGradesData?.map((ug: any) => ug.unit_id) || []);
      const filteredUnits = (unitsData || []).filter((u: any) => validUnitIds.has(u.id));
      
      setUnits(filteredUnits);
      setLoading(false);
    }

    fetchData();
  }, [gradeSlug, lessonSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!grade || !lesson) {
    return <div className="min-h-screen flex items-center justify-center">Sayfa bulunamadı</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{lesson.icon || '📘'}</span>
            <div>
              <h1 className="text-2xl font-bold">{lesson.name}</h1>
              <p className="text-indigo-100">{grade.name} • Üniteler</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border-b border-default">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted">
            <Link href="/" className="flex items-center gap-1"><Home className="w-4 h-4" /> Anasayfa</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/${gradeSlug}`}>{grade.name}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-default">{lesson.name}</span>
          </nav>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Üniteler
        </h2>

        <div className="space-y-3">
          {units.map((unit, index) => {
            const unitSlug = unit.slug || `unite-${unit.id}`;
            return (
              <Link
                key={unit.id}
                href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}
                className="block bg-surface-elevated border border-default rounded-xl p-5 hover:border-indigo-300 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <span className="text-lg font-bold text-indigo-600">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{unit.title}</h3>
                    {unit.description && <p className="text-sm text-muted">{unit.description}</p>}
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          <Link href={`/${gradeSlug}`} className="flex items-center gap-2 text-muted">
            <GraduationCap className="w-4 h-4" /> {grade.name} Derslerine Dön
          </Link>
        </div>
      </main>
    </div>
  );
}
