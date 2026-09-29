'use client';

// Testlerim (İlerlemem, yol haritası 4h). Yarım kalanlar üstte (devam et), altta son bitenler.
// Kaynak: getRecentActivities (test_sessions + cevaplar). "Yarım" = gerçekten kalan sorusu olan
// ve devam adresi kurulabilen oturum — tüm sorularını cevaplayıp sonuç ekranını görmeden
// çıkılan oturum bitmiş sayılır (bkz. dashboardActivities.hasRemainingQuestions).
import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { getRecentActivities } from '@/app/src/lib/dashboardActivities';
import type { Activity } from '@/app/src/models/types';

const RECENT_LIMIT = 20;
const DONE_SHOWN = 4;
const DATE_FMT = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' });

function whenLabel(date: Date): string {
  const key = DAY_KEY.format(date);
  const now = new Date();
  if (key === DAY_KEY.format(now)) return 'Bugün';
  if (key === DAY_KEY.format(new Date(now.getTime() - 86_400_000))) return 'Dün';
  return DATE_FMT.format(date);
}

export function MyTests() {
  const { user, supabase } = useAuth();
  const { data, error } = useSWR<Activity[]>(
    user ? ['my-tests', user.id] : null,
    () => getRecentActivities(supabase, user!.id, RECENT_LIMIT),
    { revalidateOnFocus: false }
  );

  if (error) return null;

  // Açılıp hiç soru çözülmeden kapatılan test "0/10" diye listeyi kalabalıklaştırmasın.
  const open = (data ?? []).filter((a) => !!a.resumeHref && a.questionCount > 0);
  const done = (data ?? []).filter((a) => !a.resumeHref && a.questionCount > 0).slice(0, DONE_SHOWN);

  return (
    <section aria-labelledby="testlerim" className="flex flex-col gap-4 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="testlerim" className="text-lg font-extrabold text-default sm:text-xl">
          Testlerim
        </h2>
        <Link href="/ilerlemem/aktiviteler" className="inline-flex items-center gap-1 text-sm font-extrabold text-indigo-600 hover:underline dark:text-indigo-400">
          Tümü <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {!data ? (
        <div aria-busy="true" aria-label="Testler yükleniyor" className="h-56 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : open.length === 0 && done.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-muted-foreground">
          Henüz test çözmedin. Soru Bankası&apos;ndan bir konu seçip başlayabilirsin.
        </p>
      ) : (
        <>
          {open.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-orange-800 dark:text-orange-300">Yarım kalan</h3>
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
            </div>
          )}

          {done.length > 0 && (
            <div className="flex flex-col">
              <h3 className="pb-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Biten</h3>
              <ul>
                {done.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 border-t border-default py-2.5">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-bold leading-snug text-default">{a.baseTitle ?? a.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {whenLabel(a.timestamp)} · {a.questionCount} soru
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-black text-default">%{a.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
