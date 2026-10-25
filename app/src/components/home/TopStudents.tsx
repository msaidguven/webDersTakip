'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { createClient } from '@/utils/supabase/client';
import { useIsAdmin } from '@/app/src/hooks/useIsAdmin';
import { getPublicWeeklyTopStudents, type LeaderboardEntry, type TopStudentEntry, type TopStudentEntryWithSource } from '@/app/src/lib/leaderboard';
import { Podium, Row } from '@/app/src/components/LeaderboardCard';
import s from '@/app/src/components/Leaderboard.module.css';
import r from '@/app/src/components/robotic/robotic.module.css';

// Bu haftanın en çok soru çözenleri — tüm sınıflar (get_public_weekly_top_students).
// Görünüm İlerlemem > Sıralama ile aynı (2026-10-22): ilk 3 metalik kürsü, kalanlar enerji çubuklu satır.
// Herkese açık listede kişiye özel bilgi yok: isMe her zaman false, profil bağlantısı yok.
// Admin için gerçek öğrencinin yanında "(G)": sayfa HTML'i bu bilgiyi taşımaz; admin tarayıcıda
// listeyi gerçek/sahte bilgisiyle yeniden çeker (bkz. leaderboard.ts stripIsReal).
export function TopStudents({ students, isAuthenticated }: { students: TopStudentEntry[]; isAuthenticated: boolean }) {
  const isAdmin = useIsAdmin();
  const { data: adminList } = useSWR<TopStudentEntryWithSource[]>(isAdmin ? ['admin-top-students'] : null, () =>
    getPublicWeeklyTopStudents(createClient())
  );
  const list: (TopStudentEntry & { isReal?: boolean })[] = adminList ?? students;
  if (list.length === 0) return null;

  const entries: LeaderboardEntry[] = list.map((e) => ({ ...e, isMe: false, isReal: e.isReal ?? false }));
  const max = entries[0]?.totalQuestions ?? 0;
  const rest = entries.filter((e) => e.rank > 3);

  return (
    <section aria-labelledby="top-students-title" className="flex flex-col gap-4">
      <div>
        <h2 id="top-students-title" className="text-xl font-bold tracking-tight text-default">
          Bu haftanın en çalışkanları
        </h2>
        <p className="text-sm text-muted-foreground">En çok soru çözenler · her pazartesi yeniden başlar</p>
      </div>
      <Podium entries={entries.filter((e) => e.rank <= 3)} showRealMark={isAdmin} />
      {rest.length > 0 && (
        <ol className={s.rows} aria-label="Sıralama">
          {rest.map((entry) => (
            <Row key={entry.rank} entry={entry} max={max} showRealMark={isAdmin} />
          ))}
        </ol>
      )}
      <Link href={isAuthenticated ? '/ilerlemem/siralama' : '/register'} className={`w-fit text-sm font-semibold hover:underline ${r.accent}`}>
        {isAuthenticated ? 'Tüm sıralamayı gör →' : 'Üye ol, sen de listeye gir →'}
      </Link>
    </section>
  );
}
