'use client';

// Şu an tekrar zamanı gelmiş soru sayısı (İlerlemem "Bu hafta önceliğin" + ders sayfası). get_my_review_calendar'ın
// bugün satırındaki ready_now — /tekrar yalnız next_review_at <= now olanları açar.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';

type CalendarDay = { ready_now?: number | null };

export function useReviewDue() {
  const { user, supabase } = useAuth();
  return useSWR<number>(
    user ? ['review-due', user.id] : null,
    async () => {
      const { data, error } = await supabase.rpc('get_my_review_calendar', { p_days: 1 });
      if (error) throw error;
      return ((data as CalendarDay[] | null)?.[0]?.ready_now ?? 0) as number;
    },
    { revalidateOnFocus: false }
  );
}
