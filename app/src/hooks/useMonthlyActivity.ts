'use client';

// Aylık çizelgenin verisi (bkz. lib/monthlyActivity.ts). Ay değişince ayrı önbellek anahtarı kullanır.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchMonthlyActivity, type MonthlyActivityRow } from '@/app/src/lib/monthlyActivity';

export function useMonthlyActivity(month: string) {
  const { user, supabase } = useAuth();
  return useSWR<MonthlyActivityRow[]>(
    user ? ['monthly-activity', user.id, month] : null,
    () => fetchMonthlyActivity(supabase, month),
    { revalidateOnFocus: false }
  );
}
