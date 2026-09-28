'use client';

// İlerlemem sayfasının gün bazlı etkinlik verisi (bkz. lib/progressActivity.ts). Ham gün listesi
// döner; özet/tablo bileşenleri kendi ihtiyacını bundan türetir, tek istek paylaşılır.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchDailyActivity, type DailyActivity } from '@/app/src/lib/progressActivity';

export function useProgressActivity() {
  const { user, supabase } = useAuth();
  return useSWR<DailyActivity[]>(user ? ['progress-daily-activity', user.id] : null, () => fetchDailyActivity(supabase), {
    revalidateOnFocus: false,
  });
}
