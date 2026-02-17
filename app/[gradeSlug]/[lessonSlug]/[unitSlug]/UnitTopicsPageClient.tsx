'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Props {
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
}

export default function UnitTopicsPageClient({ gradeSlug, lessonSlug, unitSlug }: Props) {
  
  const [unit, setUnit] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    async function load() {
      const unitId = parseInt(unitSlug);

      const { data: uData } = await supabase
        .from('units')
        .select('id, title')
        .eq('id', unitId)
        .single();

      if (!uData) {
        setLoading(false);
        return;
      }

      setUnit(uData);

      const { data: tData } = await supabase
        .from('topics')
        .select('id, title, slug, order_no')
        .eq('unit_id', uData.id)
        .eq('is_active', true)
        .order('order_no');

      setTopics(tData || []);
      setLoading(false);
    }

    load();
  }, [unitSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!unit) return <div className="p-8">Ünite bulunamadı</div>;

  return (
    <div className="p-8">
      <Link href={`/${gradeSlug}/${lessonSlug}`} className="text-blue-600">← Üniteler</Link>
      <h1 className="text-2xl font-bold mt-4">{unit.title}</h1>
      <p className="text-gray-600 mb-6">Konular</p>

      <div className="grid gap-4">
        {topics.map((topic: any, i: number) => {
          const topicSlug = topic.slug || topic.id;
          return (
            <Link
              key={topic.id}
              href={`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}`}
              className="border p-4 rounded hover:bg-gray-50"
            >
              <span className="font-bold mr-2">{i + 1}.</span>
              <span>{topic.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
