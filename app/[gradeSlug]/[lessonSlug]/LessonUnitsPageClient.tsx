'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Props {
  gradeSlug: string;
  lessonSlug: string;
}

export default function LessonUnitsPageClient({ gradeSlug, lessonSlug }: Props) {
  
  const [grade, setGrade] = useState<any>(null);
  const [lesson, setLesson] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    async function load() {
      const gradeId = parseInt(gradeSlug.replace('-sinif', ''));
      const lessonId = parseInt(lessonSlug);

      const [{ data: gData }, { data: lData }] = await Promise.all([
        supabase.from('grades').select('id, name').eq('id', gradeId).single(),
        supabase.from('lessons').select('id, name, icon').eq('id', lessonId).single(),
      ]);

      if (!gData || !lData) {
        setLoading(false);
        return;
      }

      setGrade(gData);
      setLesson(lData);

      const { data: uData } = await supabase
        .from('units')
        .select('id, title, slug, order_no')
        .eq('lesson_id', lData.id)
        .eq('is_active', true)
        .order('order_no');

      setUnits(uData || []);
      setLoading(false);
    }

    load();
  }, [gradeSlug, lessonSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!grade || !lesson) return <div className="p-8">Sayfa bulunamadı</div>;

  return (
    <div className="p-8">
      <Link href={`/${gradeSlug}`} className="text-blue-600">← Dersler</Link>
      <h1 className="text-2xl font-bold mt-4">{lesson.name}</h1>
      <p className="text-gray-600 mb-6">{grade.name}</p>

      <div className="grid gap-4">
        {units.map((unit: any, i: number) => {
          const unitSlug = unit.slug || unit.id;
          return (
            <Link
              key={unit.id}
              href={`/${gradeSlug}/${lessonSlug}/${unitSlug}`}
              className="border p-4 rounded hover:bg-gray-50"
            >
              <span className="font-bold mr-2">{i + 1}.</span>
              <span className="font-semibold">{unit.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
