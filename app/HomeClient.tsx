'use client';

import React from 'react';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { logger } from '@/utils/logger';
import { useRouter } from 'next/navigation';
import { GradeSelector } from './src/components/home/GradeSelector';
import { Grade } from './src/models/homeTypes';
import {
  getGradeColor,
  getGradeDescription,
  getGradeIcon,
} from './src/lib/homeMapping';

interface GradeRow {
  id: number;
  name: string;
  order_no: number;
  is_active: boolean;
  slug: string;
}

const fetcher = async (): Promise<Grade[]> => {
  logger.log('[HomeClient fetcher] Siniflar cekiliyor...');
  const supabase = createClient();
  
  // DB şeması: grades(id, name, order_no, is_active, question_count, slug)
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active, slug')
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  
  if (error) {
    logger.error('[HomeClient fetcher] HATA:', error);
    throw error;
  }
  
  logger.log('[HomeClient fetcher] Bulunan kayit:', data?.length || 0);
  
  // DB'de olmayan alanları client-side ekle
  const gradeRows = (data as GradeRow[] | null) || [];
  const grades = gradeRows.map((g) => ({
    id: g.id.toString(),
    level: g.order_no,
    name: g.name,
    slug: g.slug || `${g.order_no}-sinif`,
    description: getGradeDescription(g.order_no),
    icon: getGradeIcon(g.order_no),
    color: getGradeColor(g.order_no),
  }));
  
  logger.log('[HomeClient fetcher] SONUC:', grades);
  return grades;
};

interface HomeClientProps {
  initialGrades: Grade[];
}

export default function HomeClient({ initialGrades }: HomeClientProps) {
  const router = useRouter();
  const { data: grades, error } = useSWR(
    'grades',
    fetcher,
    {
      fallbackData: initialGrades,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
    }
  );

  const handleGradeSelect = (grade: Grade) => {
    logger.log('[HomeClient handleGradeSelect] Grade secildi:', grade);
    // Yeni SEO dostu URL: /5-sinif, /6-sinif vb.
    const url = `/${grade.slug || grade.id + '-sinif'}`;
    logger.log('[HomeClient handleGradeSelect] Yonlendiriliyor:', url);
    router.push(url);
  };

  return (
    <div className="min-h-screen">
      <main className="py-6 sm:py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <GradeSelector 
            grades={grades || []}
            isLoading={!grades}
            error={error?.message}
            onSelect={handleGradeSelect} 
          />
        </div>
      </main>

      <footer className="border-t border-default py-6 sm:py-8 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 text-center sm:text-left">
          <p className="text-muted text-sm">
            © 2026 Ders Takip. Tum haklari saklidir.
          </p>
          <div className="flex gap-6 text-sm text-muted">
            <a href="#" className="hover:text-default transition-colors">Hakkimizda</a>
            <a href="#" className="hover:text-default transition-colors">Iletisim</a>
            <a href="#" className="hover:text-default transition-colors">Gizlilik</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
