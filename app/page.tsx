import { createClient } from '@/utils/supabase/server';
import HomeClient from './HomeClient';

// ISR: Revalidate every 60 seconds for public data
export const revalidate = 60;

async function getGrades() {
  const supabase = createClient();
  
  const { data: grades, error } = await supabase
    .from('grades')
    .select('id, name, order_no, is_active')
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  if (error) {
    console.error('Error fetching grades:', error);
    return [];
  }

  return grades || [];
}

export default async function HomePage() {
  // Server-side data fetch with caching
  const grades = await getGrades();

  return <HomeClient initialGrades={grades} />;
}
