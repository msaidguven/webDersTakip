'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function LessonUnitsPageClient({ gradeSlug, lessonSlug }: { gradeSlug: string; lessonSlug: string }) {
  const [data, setData] = useState<{ lesson: any; units: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      
      // Grade ve lesson'ı slug ile bul
      const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
        supabase.from('grades').select('id, name').eq('slug', gradeSlug).single(),
        supabase.from('lessons').select('id, name, icon').eq('slug', lessonSlug).single(),
      ]);
      
      if (!gradeData || !lessonData) {
        setLoading(false);
        return;
      }

      // Unit grades üzerinden bu grade'e ait unit_id'leri çek
      const { data: unitGradesData } = await supabase
        .from('unit_grades')
        .select('unit_id')
        .eq('grade_id', gradeData.id);

      const unitIds = unitGradesData?.map((ug: any) => ug.unit_id) || [];
      
      // Bu unit'lerden lesson'a ait olanları çek
      const { data: unitsData } = await supabase
        .from('units')
        .select('*')
        .in('id', unitIds)
        .eq('lesson_id', lessonData.id)
        .eq('is_active', true)
        .order('order_no');

      setData({
        lesson: lessonData,
        units: unitsData || []
      });
      setLoading(false);
    }

    load();
  }, [gradeSlug, lessonSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!data) return <div className="p-8">Ders bulunamadı</div>;

  return (
    <div className="p-8">
      <Link href={`/${gradeSlug}`} className="text-blue-600">← Dersler</Link>
      <h1 className="text-2xl font-bold mt-4">{data.lesson.name}</h1>
      <p className="mb-6">Üniteler</p>

      <div className="grid gap-4">
        {data.units.map((unit: any, i: number) => (
          <Link
            key={unit.id}
            href={`/${gradeSlug}/${lessonSlug}/${unit.slug || unit.id}`}
            className="border p-4 rounded hover:bg-gray-50"
          >
            <span className="font-bold mr-2">{i + 1}.</span>
            {unit.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
