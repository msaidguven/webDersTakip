'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import LessonUnitsClient from './LessonUnitsClient';

export default function LessonUnitsPageClient({ gradeSlug, lessonSlug }: { gradeSlug: string; lessonSlug: string }) {
  const [data, setData] = useState<{ grade: any; lesson: any; units: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      
      // Grade ve lesson'ı slug ile bul
      const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
        supabase.from('grades').select('id, name, slug, order_no').eq('slug', gradeSlug).single(),
        supabase.from('lessons').select('id, name, icon, slug, description').eq('slug', lessonSlug).single(),
      ]);
      
      if (!gradeData || !lessonData) {
        setLoading(false);
        return;
      }

      // Üniteleri doğrudan units tablosundan çekiyoruz (unit_grades tablosu yerine)
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .eq('grade_id', gradeData.id)
        .eq('lesson_id', lessonData.id)
        .eq('is_active', true)
        .order('order_no');

      setData({
        grade: gradeData,
        lesson: lessonData,
        units: unitsData || []
      });
      setLoading(false);
    }

    load();
  }, [gradeSlug, lessonSlug]);

  if (loading) return <div className="p-8 flex justify-center text-gray-500">Yükleniyor...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Ders bulunamadı</div>;

  return (
    <LessonUnitsClient
      grade={data.grade}
      lesson={data.lesson}
      units={data.units}
      gradeSlug={gradeSlug}
      lessonSlug={lessonSlug}
    />
  );
}
