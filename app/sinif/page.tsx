import { createPublicClient } from '@/utils/supabase/public';
import { redirect, notFound } from 'next/navigation';

export const revalidate = 60;

interface Params {
  searchParams: Promise<{ sinif?: string }>;
}

export default async function SinifPage({ searchParams }: Params) {
  const params = await searchParams;
  const sinifId = params.sinif ? parseInt(params.sinif, 10) : null;
  
  if (!sinifId || isNaN(sinifId)) {
    notFound();
  }

  const supabase = createPublicClient();

  // Sınıf slug'ını çek
  const { data: gradeData, error: gradeError } = await supabase
    .from('grades')
    .select('slug')
    .eq('id', sinifId)
    .single();

  if (gradeError || !gradeData?.slug) {
    console.error('[SinifPage] Grade bulunamadi:', gradeError);
    notFound();
  }

  // Yeni SEO dostu URL'ye yönlendir
  redirect(`/${gradeData.slug}`);
}
