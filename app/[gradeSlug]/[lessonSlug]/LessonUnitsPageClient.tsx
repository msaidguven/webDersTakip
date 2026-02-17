'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface Unit {
  id: string;
  title: string;
  slug: string;
}

export default function LessonUnitsPageClient() {
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
      
      // Grade bul
      const { data: gradeData } = await supabase
        .from('grades')
        .select('id, name, slug')
        .or(`slug.eq.${gradeSlug},id.eq.${gradeSlug.replace('-sinif', '')}`)
        .single();

      // Lesson bul - slug veya id ile
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, name, slug, icon')
        .or(`slug.eq.${lessonSlug},id.eq.${lessonSlug}`)
        .single();

      if (!gradeData || !lessonData) {
        setLoading(false);
        return;
      }

      setGrade({ ...gradeData, slug: gradeData.slug || `${gradeData.id}-sinif` });
      setLesson({ ...lessonData, slug: lessonData.slug || lessonData.id.toString() });

      // Üniteleri çek
      const { data: unitsData } = await supabase
        .from('units')
        .select('id, title, slug')
        .eq('lesson_id', lessonData.id)
        .eq('is_active', true)
        .order('order_no');

      setUnits((unitsData || []).map((u: any) => ({
        id: u.id.toString(),
        title: u.title,
        slug: u.slug || u.id.toString(),
      })));
      setLoading(false);
    }

    fetchData();
  }, [gradeSlug, lessonSlug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  if (!grade || !lesson) return <div className="min-h-screen flex items-center justify-center">Sayfa bulunamadı</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold">{lesson.name}</h1>
          <p>{grade.name} • Üniteler</p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">Üniteler</h2>

        <div className="space-y-3">
          {units.map((unit, index) => (
            <Link
              key={unit.id}
              href={`/${gradeSlug}/${lessonSlug}/${unit.slug}`}
              className="block bg-surface-elevated border border-default rounded-xl p-5 hover:border-indigo-300"
            >
              <div className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">{index + 1}</span>
                <h3 className="font-semibold">{unit.title}</h3>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8">
          <Link href={`/${gradeSlug}`} className="text-indigo-600">← {grade.name} Derslerine Dön</Link>
        </div>
      </main>
    </div>
  );
}
