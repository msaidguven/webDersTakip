'use client';

// Konu ustalığı (bkz. lib/topicMastery.ts). Konu haritası, özet kartındaki "öğrenilen konu"
// ve zorlandığın konular listesi aynı SWR önbelleğini paylaşır — tek istek.
// data === null: öğrencinin sınıfı belli değil.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { fetchTopicMastery, type MasteryResult } from '@/app/src/lib/topicMastery';

export function useTopicMastery() {
  const { user, supabase } = useAuth();
  return useSWR<MasteryResult | null>(user ? ['topic-mastery', user.id] : null, () => fetchTopicMastery(supabase, user!.id), {
    revalidateOnFocus: false,
  });
}
