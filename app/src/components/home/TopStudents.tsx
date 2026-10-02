'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { getPublicWeeklyTopStudents, type TopStudentEntry, type TopStudentEntryWithSource } from '@/app/src/lib/leaderboard';

// İlk üç için sade madalya noktaları (altın / gümüş / bronz); beyaz numara AA kontrastında.
const MEDALS = ['bg-[#B98A1E]', 'bg-[#7C808C]', 'bg-[#A86A3F]'];

// Bu haftanın en çok soru çözenleri — tüm sınıflar, "Ad S." biçimi (get_public_weekly_top_students).
// v4 sade tasarım (2026-10-02): başlık kart dışında, kart içinde ince çizgili liste.
// Admin için gerçek öğrencinin yanında "(G)": sayfa HTML'i bu bilgiyi taşımaz; admin tarayıcıda
// listeyi gerçek/sahte bilgisiyle yeniden çeker (bkz. leaderboard.ts stripIsReal).
export function TopStudents({ students, isAuthenticated }: { students: TopStudentEntry[]; isAuthenticated: boolean }) {
  const isAdmin = useIsAdmin();
  const { data: adminList } = useSWR<TopStudentEntryWithSource[]>(isAdmin ? ['admin-top-students'] : null, () =>
    getPublicWeeklyTopStudents(createClient())
  );
  const list: (TopStudentEntry & { isReal?: boolean })[] = adminList ?? students;
  if (list.length === 0) return null;

  return (
    <section aria-labelledby="top-students-title" className="flex flex-col">
      <h2 id="top-students-title" className="text-xl font-bold tracking-tight text-default">
        Bu haftanın en çalışkanları
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">En çok soru çözenler · her pazartesi yeniden başlar</p>
      <ol className="flex-1 divide-y divide-[var(--border)] rounded-[20px] border border-default bg-background px-4 sm:px-5">
        {list.map((s) => (
          <li key={s.rank} className="flex items-center gap-3 py-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                MEDALS[s.rank - 1] ? `${MEDALS[s.rank - 1]} text-white` : 'bg-surface-elevated text-muted-foreground'
              }`}
              aria-label={`${s.rank}. sıra`}
            >
              {s.rank}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-default">
              {s.displayName}
              {isAdmin && s.isReal && (
                <span className="ml-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400" title="Gerçek öğrenci (sadece admin görür)">
                  (G)
                </span>
              )}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">{s.totalQuestions} soru</span>
          </li>
        ))}
        <li className="py-3">
          <Link href={isAuthenticated ? '/ilerlemem/siralama' : '/register'} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
            {isAuthenticated ? 'Tüm sıralamayı gör →' : 'Üye ol, sen de listeye gir →'}
          </Link>
        </li>
      </ol>
    </section>
  );
}
