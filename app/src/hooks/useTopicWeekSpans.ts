'use client';

// İlerlemem ders sayfasında ünite/konu öğretim haftaları (bkz. lib/kazanimPlan.ts). Hafta verisi
// herkese açık kurum verisi; kimlik gerekmez. Konu kimlikleri sıralı tutulur ki önbellek anahtarı kararlı olsun.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchTopicWeekSpans, type WeekRange } from '@/app/src/lib/kazanimPlan';

export function useTopicWeekSpans(topicIds: number[]) {
  const { supabase } = useAuth();
  const ids = [...topicIds].sort((a, b) => a - b);
  return useSWR<Record<number, WeekRange | null>>(
    ids.length ? ['topic-week-spans', ids.join(',')] : null,
    () => fetchTopicWeekSpans(supabase, ids),
    { revalidateOnFocus: false }
  );
}
