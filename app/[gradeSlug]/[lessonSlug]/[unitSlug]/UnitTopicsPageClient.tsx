'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface Topic {
  id: string;
  title: string;
  slug: string;
}

export default function UnitTopicsPageClient() {
  const params = useParams();
  const gradeSlug = params.gradeSlug as string;
  const lessonSlug = params.lessonSlug as string;
  const unitSlug = params.unitSlug as string;
  
  const [grade, setGrade] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      
      const { data: gradeData } = await supabase
        .from('grades')
        .select('id, name, slug')
        .or(`slug.eq.${gradeSlug},id.eq.${gradeSlug.replace('-sinif', '')}`)
        .single();

      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id, name, slug')
        .or(`slug.eq.${lessonSlug},id.eq.${lessonSlug}`)
        .single();

      if (!gradeData || !lessonData) {
        setLoading(false);
        return;
      }

      setGrade({ ...gradeData, slug: gradeData.slug || `${gradeData.id}-sinif` });
      setLesson({ ...lessonData, slug: lessonData.slug || lessonData.id.toString() });

      const { data: unitData } = await supabase
        .from('units')
        .select('id, title, slug')
        .or(`slug.eq.${unitSlug},id.eq.${unitSlug}`)
        .eq('lesson_id', lessonData.id)
        .single();

      if (!unitData) {
        setLoading(false);
        return;
      }

      setUnit({ ...unitData, slug: unitData.slug || unitData.id.toString() });

      const { data: topicsData } = await supabase
        .from('topics')
        .select('id, title, slug')
        .eq('unit_id', unitData.id)
        .eq('is_active', true)
        .order('order_no');

      setTopics((topicsData || []).map((t: any) => ({
        id: t.id.toString(),
        title: t.title,
        slug: t.slug || t.id.toString(),
      })));
      setLoading(false);
    }

    fetchData();
  }, [gradeSlug, lessonSlug, unitSlug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  if (!grade || !lesson || !unit) return <div className="min-h-screen flex items-center justify-center">Sayfa bulunamadı</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold">{unit.title}</h1>
          <p>{grade.name} • {lesson.name}</p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold mb-6">Konular</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics.map((topic, index) => (
            <Link
              key={topic.id}
              href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug}`}
              className="block bg-surface-elevated border border-default rounded-xl p-5 hover:border-indigo-300"
            >
              <div className="flex items-center gap-4">
                <span className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center font-bold text-indigo-600">{index + 1}</span>
                <h3 className="font-semibold">{topic.title}</h3>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex gap-4">
          <Link href={`/${gradeSlug}/${lessonSlug}`} className="text-indigo-600">← Üniteler</Link>
          <Link href={`/${gradeSlug}`} className="text-indigo-600">← Dersler</Link>
        </div>
      </main>
    </div>
  );
}
