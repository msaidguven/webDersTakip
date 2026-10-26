'use client';

// Yarım kalan testler (İlerlemem, yol haritası 4h). 2026-10-12 kullanıcı kararı: bitenler burada
// gösterilmez — tüm testler /ilerlemem/aktiviteler'de; yarım test yoksa bölüm hiç görünmez. Kaynak:
// getRecentActivities (test_sessions + cevaplar). "Yarım" = gerçekten kalan sorusu olan ve devam adresi
// kurulabilen oturum — tüm sorularını cevaplayıp sonuç ekranını görmeden çıkılan oturum bitmiş sayılır
// (bkz. dashboardActivities.hasRemainingQuestions). "Devam et" soru bankası testlerini sayfa
// değiştirmeden oynatıcıda açar (useQuizTestLauncher); sıralı testler kendi sayfasına gider.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { getRecentActivities } from '@/app/src/lib/dashboardActivities';
import { useQuizTestLauncher } from '@/app/src/hooks/useQuizTestLauncher';
import type { Activity } from '@/app/src/models/types';
import r from '../robotic/robotic.module.css';

const RECENT_LIMIT = 20;

export function MyTests() {
  const { user, supabase } = useAuth();
  const router = useRouter();
  const { data, error, mutate } = useSWR<Activity[]>(
    user ? ['my-tests', user.id] : null,
    () => getRecentActivities(supabase, user!.id, RECENT_LIMIT),
    { revalidateOnFocus: false }
  );
  const { open: openTest, loading, error: testError, conflict, player } = useQuizTestLauncher(() => void mutate());
  const [active, setActive] = useState<Activity | null>(null);

  // Oturum bu arada başka yerde bitmişse API devam yerine çakışma döner; seçimi soru bankası sayfası sunar.
  useEffect(() => {
    if (conflict && active) router.push(active.resumeHref!);
  }, [conflict, active, router]);

  // Açılıp hiç soru çözülmeden kapatılan test "0/10" diye listeyi kalabalıklaştırmasın.
  const open = (data ?? []).filter((a) => !!a.resumeHref && a.questionCount > 0);
  if (error || open.length === 0) return player || null;

  return (
    <section aria-labelledby="yarim-testler" className="flex flex-col gap-3">
      <h2 id="yarim-testler" className={`text-lg font-bold tracking-tight text-default uppercase sm:text-xl ${r.display}`}>
        Yarım kalan testlerin
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {open.map((a) => {
          const total = a.totalQuestionCount ?? a.questionCount;
          const pct = total ? Math.round((a.questionCount / total) * 100) : 0;
          return (
            <li
              key={a.id}
              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 ${r.panel}`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-[15px] font-semibold leading-snug text-default">{a.baseTitle ?? a.title}</span>
                <span className={`block h-2 ${r.track}`} aria-hidden="true">
                  <span className={`block ${r.fill}`} style={{ width: `${pct}%` }} />
                </span>
                {/* Sayıdan sonra ek yok: "2/10 soru çözüldü". */}
                <span className={`text-xs ${r.muted} ${r.mono}`}>{a.questionCount}/{total} soru çözüldü</span>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Link
                  href={a.resumeHref!}
                  onClick={(e) => {
                    // Değiştirici tuşlu tıklar tarayıcının "yeni sekmede aç" davranışına kalır.
                    if (!a.resumeEndpoint || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    setActive(a);
                    void openTest(a.resumeEndpoint, a.resumeHref!);
                  }}
                  aria-busy={loading && active?.id === a.id}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold ${r.btnNeon} ${r.btnText}`}
                >
                  Devam et
                  {loading && active?.id === a.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  )}
                </Link>
                {testError && active?.id === a.id && (
                  <span role="alert" className="text-xs text-red-500">{testError}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {player}
    </section>
  );
}
