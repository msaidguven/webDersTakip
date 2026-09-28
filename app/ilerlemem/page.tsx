'use client';

// İlerlemem (eski "Panel", yol haritası 4 — 2026-09-28 onaylı taslak:
// https://claude.ai/artifact/KY9tfyz86FfaSnktevr5d3). Anasayfa "Bugün"ü (şimdi ne yapayım)
// yanıtlar; burası "nasıl gidiyorum, nerede eksiğim". Anasayfadaki kutular (günlük hedef,
// bugünkü görev) burada TEKRAR ETMEZ.
//
// Taslaktaki sıra: Son 7 gün → zorlandığın konular → tekrar takvimi → konu haritası →
// son 4 hafta → testlerim → rozetler → sıralama. Henüz yenilenmemiş bölümler (4d–4i) geçici
// olarak eski bileşenleriyle duruyor ve sırası geldikçe değişecek.
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useDashboardViewModel } from '../src/viewmodels/useDashboardViewModel';
import { SRSWidget } from '../src/components/SRSWidget';
import { ActivityFeed } from '../src/components/ActivityFeed';
import { AuthPrompt } from '../src/components/AuthPrompt';
import { ProgressSummary } from '../src/components/progress/ProgressSummary';
import { TopicMap } from '../src/components/progress/TopicMap';
import { WeeksTable } from '../src/components/progress/WeeksTable';

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-elevated ${className}`} />;
}

export default function IlerlememPage() {
  const {
    data,
    isAuthenticated,
    gradeName,
    isAuthResolving,
    isProfileLoading,
    isStatsLoading,
    isActivityLoading,
    handleSRSReview,
  } = useDashboardViewModel();

  const meta = [gradeName, isAuthenticated && !isProfileLoading ? data.user.name : null].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-8 sm:gap-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className="flex flex-col gap-1">
          {meta && <p className="text-sm font-bold text-muted-foreground">{meta}</p>}
          <h1 className="text-3xl font-black tracking-tight text-default sm:text-5xl">İlerlemem</h1>
        </header>

        {isAuthResolving ? (
          <SkeletonBlock className="h-56" />
        ) : !isAuthenticated ? (
          <AuthPrompt message="Son 7 gününü, serini ve hangi konularda zorlandığını görmek için giriş yap." />
        ) : (
          <>
            <ProgressSummary />

            {/* Geçici (4f/4g gelene kadar): tekrar zamanı gelen sorular. */}
            {!isStatsLoading && data.srsReview && <SRSWidget review={data.srsReview} onReview={handleSRSReview} />}

            <div id="derslerim" className="scroll-mt-24">
              <TopicMap />
            </div>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <WeeksTable />
              {/* Geçici (4h Testlerim gelene kadar): yarım kalan testler. */}
              {isActivityLoading ? (
                <SkeletonBlock className="h-48" />
              ) : (
                <ActivityFeed
                  activities={data.recentActivities.filter((a) => a.isComplete === false && !!a.resumeHref)}
                  seeAllHref="/ilerlemem/aktiviteler"
                  title="Yarım Kalan Testler"
                  emptyTitle="Yarım kalan test yok"
                  emptySubtitle="Tüm testlerini tamamlamışsın."
                />
              )}
            </div>

            <Link
              href="/ilerlemem/siralama"
              className="flex items-center justify-between gap-4 rounded-2xl border border-default bg-background px-5 py-4 text-default transition-colors hover:border-indigo-400 sm:px-7 sm:py-5"
            >
              <span className="text-base font-bold">Haftalık sıralama</span>
              <span className="flex items-center gap-1.5 text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                Sıralamayı gör <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
