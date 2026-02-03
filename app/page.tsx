import { createClient } from '@/utils/supabase/server';
import HomeClient from './HomeClient';
import { Grade } from './src/models/homeTypes';

// ISR: Revalidate every 60 seconds for public data
export const revalidate = 60;

// DB'de olmayan alanlar için client-side mapping
function getGradeDescription(level: number): string {
  const descriptions: Record<number, string> = {
    6: 'Ortaokul 1. seviye',
    7: 'Ortaokul 2. seviye',
    8: 'Ortaokul 3. seviye - LGS',
    9: 'Lise 1. sinif',
    10: 'Lise 2. sinif',
    11: 'Lise 3. sinif - YKS hazirlik',
    12: 'Lise 4. sinif - YKS',
  };
  return descriptions[level] || `${level}. Sinif`;
}

function getGradeIcon(level: number): string {
  const icons: Record<number, string> = {
    6: '📚', 7: '📖', 8: '🎯', 9: '🎓', 10: '🔬', 11: '⚡', 12: '🚀',
  };
  return icons[level] || '📖';
}

function getGradeColor(level: number): string {
  const colors: Record<number, string> = {
    6: 'from-emerald-500 to-teal-500',
    7: 'from-cyan-500 to-blue-500',
    8: 'from-blue-500 to-indigo-500',
    9: 'from-indigo-500 to-purple-500',
    10: 'from-purple-500 to-pink-500',
    11: 'from-pink-500 to-rose-500',
    12: 'from-orange-500 to-amber-500',
  };
  return colors[level] || 'from-indigo-500 to-purple-500';
}

async function getGrades(): Promise<Grade[]> {
  console.log('[getGrades] Siniflar cekiliyor...');
  const supabase = await createClient();
  
  // DB şeması: grades(id, name, order_no, is_active, question_count)
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active')
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  if (error) {
    console.error('[getGrades] HATA:', error);
    return [];
  }

  console.log('[getGrades] Bulunan kayit sayisi:', data?.length || 0);

  // DB'de olmayan alanları client-side ekle
  const grades = (data || []).map((g: any) => ({
    id: g.id.toString(),
    level: g.order_no,
    name: g.name,
    description: getGradeDescription(g.order_no),
    icon: getGradeIcon(g.order_no),
    color: getGradeColor(g.order_no),
  }));
  
  console.log('[getGrades] SONUC:', grades);
  return grades;
}

export default async function HomePage() {
  const grades = await getGrades();
  return <HomeClient initialGrades={grades} />;
}
