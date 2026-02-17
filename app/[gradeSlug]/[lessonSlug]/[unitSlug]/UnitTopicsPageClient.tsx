'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function UnitTopicsPageClient({ gradeSlug, lessonSlug, unitSlug }: { gradeSlug: string; lessonSlug: string; unitSlug: string }) {
  const [data, setData] = useState<{ unit: any; topics: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      
      // Unit'i bul (slug veya id)
      let unitQuery = supabase.from('units').select('*');
      if (!isNaN(Number(unitSlug))) {
        unitQuery = unitQuery.eq('id', unitSlug);
      } else {
        unitQuery = unitQuery.eq('slug', unitSlug);
      }
      
      const { data: unitData } = await unitQuery.single();
      
      if (!unitData) {
        setLoading(false);
        return;
      }

      // Konuları çek
      const { data: topicsData } = await supabase
        .from('topics')
        .select('*')
        .eq('unit_id', unitData.id)
        .eq('is_active', true)
        .order('order_no');

      setData({
        unit: unitData,
        topics: topicsData || []
      });
      setLoading(false);
    }

    load();
  }, [unitSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!data) return <div className="p-8">Ünite bulunamadı</div>;

  return (
    <div className="p-8">
      <Link href={`/${gradeSlug}/${lessonSlug}`} className="text-blue-600">← Üniteler</Link>
      <h1 className="text-2xl font-bold mt-4">{data.unit.title}</h1>
      <p className="mb-6">Konular</p>

      <div className="grid gap-4">
        {data.topics.map((topic: any, i: number) => (
          <Link
            key={topic.id}
            href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topic.slug || topic.id}`}
            className="border p-4 rounded hover:bg-gray-50"
          >
            <span className="font-bold mr-2">{i + 1}.</span>
            {topic.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
