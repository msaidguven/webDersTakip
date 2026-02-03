import { createClient } from '@/utils/supabase/server';
import HomeClient from './HomeClient';
import { Grade } from './src/models/homeTypes';

// ISR: Revalidate every 60 seconds for public data
export const revalidate = 60;

async function getGrades(): Promise<Grade[]> {
  console.log('[getGrades] Siniflar cekiliyor...');
  const supabase = await createClient();
  
  // DB şeması: grades(id, name, order_no, is_active, question_count)
  const { data, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active, description, icon, color')
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
    description: g.description || '',
    icon: g.icon || '📖',
    color: g.color || 'from-indigo-500 to-purple-500',
  }));
  
  console.log('[getGrades] SONUC:', grades);
  return grades;
}

export default async function HomePage() {
  const grades = await getGrades();
  return <HomeClient initialGrades={grades} />;
}
