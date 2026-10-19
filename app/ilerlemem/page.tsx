'use client';

// İlerlemem (eski "Panel", yol haritası 4 — 2026-09-28 onaylı taslak:
// https://claude.ai/artifact/KY9tfyz86FfaSnktevr5d3). Anasayfa "Bugün"ü (şimdi ne yapayım)
// yanıtlar; burası "nasıl gidiyorum, nerede eksiğim". Anasayfadaki kutular (günlük hedef,
// bugünkü görev) burada TEKRAR ETMEZ.
//
// Sıra (2026-10-12, Sınav Hazırlık projesindeki tasarımdan — taslak https://claude.ai/artifact/BhprJ2kq1N4gouA6tRTmkH):
// Son 7 gün → yarım kalan testler (yalnız varsa; bitenler /ilerlemem/aktiviteler'de) → bu hafta önceliğin |
// ders raporları (her ders /ilerlemem/[ders]: ünite başarı grafiği, zorlandığın konular, tüm konular) →
// rozetler → tüm testler / sıralama; günlük hedef seçimi başlıkta. Her bölüm kendi verisini SWR ile çeker;
// aynı veriyi kullananlar önbelleği paylaşır (konu ustalığı: öncelikler + ders listesi + özet).
import { useEffect } from 'react';
import Link from 'next/link';
import { useSWRConfig } from 'swr';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../src/context/AuthContext';
import { useMyProfileBasics } from '../src/hooks/useMyGradeSlug';
import { onQuizModalClosed } from '../src/lib/panelRefreshBridge';
import { AuthPrompt } from '../src/components/AuthPrompt';
import { ProgressSummary } from '../src/components/progress/ProgressSummary';
import { WeeklyPriorities } from '../src/components/progress/WeeklyPriorities';
import { LessonList } from '../src/components/progress/LessonList';
import { MyTests } from '../src/components/progress/MyTests';
import { Badges } from '../src/components/progress/Badges';
import { DailyGoalPicker } from '../src/components/progress/DailyGoalPicker';

// Test penceresi (bu rotadaki @modal) kapanınca tazelenecek bölüm verileri.
const PROGRESS_KEYS = new Set(['progress-daily-activity', 'topic-mastery', 'review-due', 'my-tests']);

export default function IlerlememPage() {
  const { user, loading } = useAuth();
  const profile = useMyProfileBasics();
  const { mutate } = useSWRConfig();

  useEffect(
    () => onQuizModalClosed(() => void mutate((key) => Array.isArray(key) && PROGRESS_KEYS.has(key[0]))),
    [mutate]
  );

  const meta = [profile?.gradeName, profile?.fullName].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            {user && meta && <p className="text-sm font-bold text-muted-foreground">{meta}</p>}
            <h1 className="text-3xl font-black tracking-tight text-default sm:text-5xl">İlerlemem</h1>
          </div>
          {user && <DailyGoalPicker />}
        </header>

        {loading ? (
          <div className="h-56 animate-pulse rounded-2xl bg-surface-elevated" />
        ) : !user ? (
          <AuthPrompt message="Son 7 gününü, serini ve hangi konularda zorlandığını görmek için giriş yap." />
        ) : (
          <>
            <ProgressSummary />

            <MyTests />

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
              <WeeklyPriorities />
              <div id="derslerim" className="scroll-mt-24">
                <LessonList />
              </div>
            </div>

            <Badges />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { href: '/ilerlemem/aktiviteler', label: 'Tüm testlerim', cta: 'Testleri gör' },
                { href: '/ilerlemem/siralama', label: 'Haftalık sıralama', cta: 'Sıralamayı gör' },
                { href: '/ders-takip-cizelgesi', label: 'Ders takip çizelgesi', cta: 'Çizelgeyi gör' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-default bg-background px-5 py-4 text-default transition-colors hover:border-indigo-400 sm:px-7 sm:py-5"
                >
                  <span className="text-base font-bold">{l.label}</span>
                  <span className="flex items-center gap-1.5 text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                    {l.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
