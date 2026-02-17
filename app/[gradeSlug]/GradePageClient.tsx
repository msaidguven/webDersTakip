'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function GradePageClient({ gradeSlug }: { gradeSlug: string }) {
  const [grade, setGrade] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    async function load() {
      // Grade slug ile bul
      const { data: gradeData, error } = await supabase
        .from('grades')
        .select('id, name, order_no, slug')
        .eq('slug', gradeSlug)
        .single();

      if (error || !gradeData) {
        console.log('Grade hatası:', error);
        setLoading(false);
        return;
      }

      setGrade(gradeData);

      // Dersleri çek
      const { data: lgData } = await supabase
        .from('lesson_grades')
        .select('lesson_id')
        .eq('grade_id', gradeData.id)
        .eq('is_active', true);

      const ids = lgData?.map((x: any) => x.lesson_id) || [];
      
      if (ids.length > 0) {
        const { data: dersler } = await supabase
          .from('lessons')
          .select('id, name, icon, slug, order_no')
          .in('id', ids)
          .eq('is_active', true)
          .order('order_no');
        
        setLessons(dersler || []);
      }
      
      setLoading(false);
    }

    load();
  }, [gradeSlug]);

  if (loading) return <div className="p-8">Yükleniyor...</div>;
  if (!grade) return <div className="p-8">Sınıf bulunamadı</div>;

  return (
    <div className="p-8">
      <Link href="/" className="text-blue-600">← Anasayfa</Link>
      <h1 className="text-2xl font-bold mt-4">{grade.name}</h1>
      <p className="text-gray-600 mb-6">Ders seç</p>

      <div className="grid gap-4">
        {lessons.map((ders: any) => {
          const dersSlug = ders.slug || ders.id;
          return (
            <Link
              key={ders.id}
              href={`/${gradeSlug}/${dersSlug}`}
              className="border p-4 rounded hover:bg-gray-50"
            >
              <span className="mr-2">{ders.icon || '📘'}</span>
              <span className="font-semibold">{ders.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
