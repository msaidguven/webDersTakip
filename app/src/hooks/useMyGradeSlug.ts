'use client';

// Girişli öğrencinin sınıf slug'ı ("6-sinif") — site menüsü "Dersler"/"Soru Bankası"yı doğrudan
// kendi sınıfına götürsün diye. Sınıf seçilmemişse null.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';

export function useMyGradeSlug(): string | null {
  const { user, supabase } = useAuth();
  const { data } = useSWR(
    user ? ['my-grade-slug', user.id] : null,
    async () => {
      const { data: profile } = await supabase.from('profiles').select('grade_id').eq('id', user!.id).maybeSingle();
      const gradeId = (profile as { grade_id: number | null } | null)?.grade_id;
      if (!gradeId) return null;
      const { data: grade } = await supabase.from('grades').select('slug').eq('id', gradeId).maybeSingle();
      return (grade as { slug: string | null } | null)?.slug ?? null;
    },
    { revalidateOnFocus: false }
  );
  return data ?? null;
}
