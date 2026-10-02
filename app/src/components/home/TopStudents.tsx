'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, Trophy } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { SectionCard } from './SectionCard';
import { getPublicWeeklyTopStudents, type TopStudentEntry, type TopStudentEntryWithSource } from '@/app/src/lib/leaderboard';

const MEDAL_STYLES = [
  'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950',
  'bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-900',
  'bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950',
];

// Tüm sınıflardan bu haftanın en çok soru çözen öğrencileri (kullanıcı talebi 2026-09-26).
// Veri sunucuda (ISR) çekilir, isimler "Ad S." biçiminde (get_public_weekly_top_students).
// 2026-10-02: anasayfada "Yeni eklenenler"in yanında yarım genişlik kart (dikey liste).
// Admin için gerçek öğrencilerin yanında "(G)" (geçici sahte kayıtlardan ayırmak için): sayfa
// HTML'i bu bilgiyi taşımaz; admin tarayıcıda listeyi gerçek/sahte bilgisiyle yeniden çeker.
export function TopStudents({ students, isAuthenticated }: { students: TopStudentEntry[]; isAuthenticated: boolean }) {
  const isAdmin = useIsAdmin();
  const { data: adminList } = useSWR<TopStudentEntryWithSource[]>(isAdmin ? ['admin-top-students'] : null, () =>
    getPublicWeeklyTopStudents(createClient())
  );
  const list: (TopStudentEntry & { isReal?: boolean })[] = adminList ?? students;
  if (list.length === 0) return null;

  return (
    <SectionCard
      tone="amber"
      headingId="top-students-title"
      icon={<Trophy className="h-5 w-5" aria-hidden="true" />}
      title="Haftanın en çalışkanları"
      subtitle="En çok soru çözenler · her pazartesi sıfırlanır"
      bodyClassName="flex flex-1 flex-col"
    >

      <ol className="divide-y divide-[var(--border)]">
        {list.map((s) => (
          <li key={s.rank} className="flex items-center gap-3 px-5 py-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                MEDAL_STYLES[s.rank - 1] ?? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
              }`}
              aria-label={`${s.rank}. sıra`}
            >
              {s.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-default">
              {s.displayName}
              {isAdmin && s.isReal && (
                <span className="ml-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400" title="Gerçek öğrenci (sadece admin görür)">
                  (G)
                </span>
              )}
            </span>
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">{s.totalQuestions} soru</span>
          </li>
        ))}
      </ol>

      <Link
        href={isAuthenticated ? '/ilerlemem/siralama' : '/register'}
        className="mt-auto flex items-center justify-center gap-1 border-t border-default px-5 py-3 text-sm font-bold text-indigo-600 transition-colors hover:bg-surface dark:text-indigo-400"
      >
        {isAuthenticated ? 'Tüm sıralamayı gör' : 'Üye ol, sen de listeye gir'}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </SectionCard>
  );
}
