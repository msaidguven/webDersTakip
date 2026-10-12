'use client';

// Yarım kalan testler (İlerlemem, yol haritası 4h). 2026-10-12 kullanıcı kararı: bitenler burada
// gösterilmez (sayfayı kalabalıklaştırıyordu) — tüm testler /ilerlemem/aktiviteler'de; yarım test
// yoksa bölüm hiç görünmez. Kaynak: getRecentActivities (test_sessions + cevaplar). "Yarım" = gerçekten kalan sorusu olan
// ve devam adresi kurulabilen oturum — tüm sorularını cevaplayıp sonuç ekranını görmeden
// çıkılan oturum bitmiş sayılır (bkz. dashboardActivities.hasRemainingQuestions).
import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { getRecentActivities } from '@/app/src/lib/dashboardActivities';
import type { Activity } from '@/app/src/models/types';

const RECENT_LIMIT = 20;

export function MyTests() {
  const { user, supabase } = useAuth();
  const { data, error } = useSWR<Activity[]>(
    user ? ['my-tests', user.id] : null,
    () => getRecentActivities(supabase, user!.id, RECENT_LIMIT),
    { revalidateOnFocus: false }
  );

  // Açılıp hiç soru çözülmeden kapatılan test "0/10" diye listeyi kalabalıklaştırmasın.
  const open = (data ?? []).filter((a) => !!a.resumeHref && a.questionCount > 0);
  if (error || open.length === 0) return null;

  return (
    <section aria-labelledby="yarim-testler" className="flex flex-col gap-3">
      <h2 id="yarim-testler" className="text-lg font-extrabold text-default sm:text-xl">
        Yarım kalan testler
      </h2>
      <ul className="flex flex-col gap-2">
        {open.map((a) => {
          const total = a.totalQuestionCount ?? a.questionCount;
          const pct = total ? Math.round((a.questionCount / total) * 100) : 0;
          return (
            <li key={a.id} className="flex flex-col gap-2.5 rounded-2xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/30 dark:bg-orange-500/10 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-sm font-extrabold leading-snug text-default">{a.baseTitle ?? a.title}</span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-orange-200 dark:bg-orange-500/20" aria-hidden="true">
                  <span className="block h-full rounded-full bg-orange-600" style={{ width: `${pct}%` }} />
                </span>
                {/* Sayıdan sonra ek yok: "2/10 soru çözüldü". */}
                <span className="text-xs text-muted-foreground">{a.questionCount}/{total} soru çözüldü</span>
              </div>
              <Link
                href={a.resumeHref!}
                className="flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-extrabold text-white transition-colors hover:bg-indigo-700"
              >
                Devam et
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
