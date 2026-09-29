'use client';

// Girişli öğrencinin temel profil bilgisi: ad, sınıf adı/slug'ı ve günlük hedefi. Site menüsü (Dersler / Soru
// Bankası kendi sınıfına) ve İlerlemem başlığı aynı SWR önbelleğini paylaşır — tek istek.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { parseDailyGoal, type DailyGoal } from '@/app/src/lib/dashboardStreak';

export interface MyProfileBasics {
  fullName: string | null;
  gradeName: string | null;
  gradeSlug: string | null;
  dailyGoal: DailyGoal;
}

export function useMyProfileBasics(): MyProfileBasics | null {
  const { user, supabase } = useAuth();
  const { data } = useSWR(
    user ? ['my-profile-basics', user.id] : null,
    async (): Promise<MyProfileBasics> => {
      const { data: profile } = await supabase.from('profiles').select('full_name, grade_id, daily_goal').eq('id', user!.id).maybeSingle();
      const row = profile as { full_name: string | null; grade_id: number | null; daily_goal?: number } | null;
      const dailyGoal = parseDailyGoal(row?.daily_goal);
      if (!row?.grade_id) return { fullName: row?.full_name ?? null, gradeName: null, gradeSlug: null, dailyGoal };
      const { data: grade } = await supabase.from('grades').select('name, slug').eq('id', row.grade_id).maybeSingle();
      const g = grade as { name: string | null; slug: string | null } | null;
      return { fullName: row.full_name, gradeName: g?.name ?? null, gradeSlug: g?.slug ?? null, dailyGoal };
    },
    { revalidateOnFocus: false }
  );
  return data ?? null;
}

export function useMyGradeSlug(): string | null {
  return useMyProfileBasics()?.gradeSlug ?? null;
}
