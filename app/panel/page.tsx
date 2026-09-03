'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useDashboardViewModel } from '../src/viewmodels/useDashboardViewModel';
import { takePendingLessonId } from '../src/lib/panelLessonBridge';
import { PanelShell } from '../src/components/PanelShell';
import { StatsRow } from '../src/components/StatsRow';
import { SRSWidget } from '../src/components/SRSWidget';
import { WeeklyProgress } from '../src/components/WeeklyProgress';
import { ActivityFeed } from '../src/components/ActivityFeed';
import { DailyGoalCard } from '../src/components/DailyGoalCard';
import { AuthPrompt } from '../src/components/AuthPrompt';
import { LeaderboardCard } from '../src/components/LeaderboardCard';
import { UnitAccordion } from '../src/components/UnitAccordion';
import { MobileLessonsCard } from '../src/components/MobileLessonsCard';

type UnitFilter = 'all' | 'in_progress' | 'completed';

const UNIT_FILTERS: { id: UnitFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'in_progress', label: 'Devam Edenler' },
  { id: 'completed', label: 'Tamamlananlar' },
];

// Panel artık tek bir global spinnerla değil, her bölüm kendi verisi gelince ayrı ayrı
// dolduruluyor (bkz. kullanıcının "adım adım yüklensin, hepsini beklemeden" isteği,
// 2026-09-02) — bu, o bölümlerin yer tutucusu.
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl bg-white/5 animate-pulse ${className}`} />;
}

export default function PanelPage() {
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');
  const pendingLessonIdRef = useRef<string | null>(null);
  const {
    data,
    isAuthenticated,
    unitsContext,
    isSwitchingLesson,
    isAuthResolving,
    isProfileLoading,
    isUnitsLoading,
    isStatsLoading,
    isActivityLoading,
    isOverallLoading,
    selectLesson,
    handleSRSReview,
  } = useDashboardViewModel();

  // Panel dışında bir sayfadayken (profil, siralama, aktiviteler) sidebar'dan bir derse
  // tıklanırsa önce buraya yönlendiriliyor; hangi dersin seçileceği panelLessonBridge
  // (sessionStorage) ile taşınıyor — mount olur olmaz bir kere okunup temizleniyor,
  // sonra üniteler yüklenince (selectLesson'ın ihtiyaç duyduğu sınıf bağlamı hazır olunca) uygulanıyor.
  useEffect(() => {
    pendingLessonIdRef.current = takePendingLessonId();
  }, []);

  useEffect(() => {
    if (isUnitsLoading || !pendingLessonIdRef.current) return;
    selectLesson(pendingLessonIdRef.current);
    pendingLessonIdRef.current = null;
  }, [isUnitsLoading, selectLesson]);

  if (isAuthResolving) {
    return (
      <PanelShell isAuthenticated={false}>
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell
      isAuthenticated={isAuthenticated}
      userName={data.user.name}
      onSelectLesson={selectLesson}
    >
      {/* Welcome Section */}
      <div className="relative overflow-hidden mb-6 sm:mb-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-pink-500/10 border border-default p-5 sm:p-8">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-12 -bottom-12 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-default mb-2">
            {!isAuthenticated ? (
              <>Kişisel <span className="gradient-text">panelin</span> seni bekliyor 👋</>
            ) : isProfileLoading ? (
              <SkeletonBlock className="h-7 w-64 max-w-full" />
            ) : (
              <>Tekrar Hoşgeldin, <span className="gradient-text">{data.user.name}</span>! 👋</>
            )}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            Bugün öğrenme hedeflerine ulaşmak için harika bir gün. Hadi başlayalım!
          </p>

          {/* Kaldırılan /progress sayfasının genel özeti artık burada — bkz. kullanıcıyla
              2026-09-02 tartışması: "istatistik sayfasını kaldır yerine ... buraya sığdır" */}
          {isAuthenticated && isOverallLoading && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-white/10">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonBlock key={i} className="h-10 w-20" />
              ))}
            </div>
          )}
          {isAuthenticated && !isOverallLoading && data.overallStats && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-white/10">
              <div>
                <div className="text-lg sm:text-xl font-bold text-default">{data.overallStats.totalQuestions}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">Toplam Soru</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-emerald-400">{data.overallStats.correctAnswers}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">Doğru</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-rose-400">{data.overallStats.wrongAnswers}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">Yanlış</div>
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-indigo-400">%{data.overallStats.accuracy}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground">Başarı Oranı</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isAuthenticated ? (
        <>
          {/* Daily Goal / CTA */}
          <div className="mb-6 sm:mb-8">
            {isStatsLoading ? (
              <SkeletonBlock className="h-32" />
            ) : (
              <DailyGoalCard
                dailyProgress={data.user.dailyProgress}
                dailyGoal={data.user.dailyGoal}
                streak={data.user.streak}
                dueSrsCount={data.srsReview?.questionCount ?? 0}
              />
            )}
          </div>

          {/* Stats Row */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-sm sm:text-base font-semibold text-default mb-3 sm:mb-4">
              Bugünkü İstatistiklerin
            </h2>
            {isStatsLoading ? (
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <SkeletonBlock key={i} className="h-16 sm:h-20" />
                ))}
              </div>
            ) : (
              <StatsRow stats={data.stats} />
            )}
          </div>

          {/* Mobile Lessons Card (Sadece mobilde istatistiklerin altında görünür) */}
          <div className="lg:hidden mb-6 sm:mb-8">
            <MobileLessonsCard
              isAuthenticated={isAuthenticated}
              selectedLessonId={data.selectedLessonId}
              onSelectLesson={selectLesson}
            />
          </div>
        </>
      ) : (
        <div className="mb-6 sm:mb-8">
          <AuthPrompt message="Günlük hedefini, serini ve bugünkü istatistiklerini görmek için giriş yap." />
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
        {/* Left Column - SRS & Units (2/3) */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8">
          {/* SRS Alert */}
          {isAuthenticated && !isStatsLoading && data.srsReview && (
            <SRSWidget review={data.srsReview} onReview={handleSRSReview} />
          )}

          {/* Units Section */}
          <div id="uniteler" className="scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-default">Üniteler</h2>
                {unitsContext && (unitsContext.lessonName || unitsContext.gradeName) && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {[unitsContext.gradeName, unitsContext.lessonName].filter(Boolean).join(' • ')}
                  </p>
                )}
              </div>
              <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
                {UNIT_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setUnitFilter(filter.id)}
                    className={`px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors rounded-lg whitespace-nowrap ${
                      unitFilter === filter.id
                        ? 'bg-primary/10 text-indigo-400 border border-primary/20'
                        : 'text-muted-foreground hover:text-default hover:bg-white/5'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {!isAuthenticated ? (
              <AuthPrompt message="Ünitelerini ve ilerlemeni görmek için giriş yap." />
            ) : isUnitsLoading || isSwitchingLesson ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <SkeletonBlock key={i} className="h-16" />
                ))}
              </div>
            ) : data.units.length > 0 ? (
              (() => {
                const filteredUnits =
                  unitFilter === 'all' ? data.units : data.units.filter((u) => u.status === unitFilter);
                return filteredUnits.length > 0 ? (
                  <UnitAccordion
                    units={filteredUnits}
                    topicsByUnitId={data.topicsByUnitId}
                    defaultOpenUnitId={data.activeUnitId}
                  />
                ) : (
                  <div className="rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8 text-center">
                    <p className="text-muted-foreground text-sm">
                      {unitFilter === 'in_progress' ? 'Devam eden ünite yok.' : 'Henüz tamamlanan ünite yok.'}
                    </p>
                  </div>
                );
              })()
            ) : (
              <div className="rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8 text-center">
                <p className="text-default font-medium mb-1">Henüz bir derse başlamadın</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Üniteler burada görünsün diye önce bir sınıf ve ders seçip ilk testini çöz.
                </p>
                <Link
                  href="/"
                  className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
                >
                  Derse Başla
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Weekly & Activity (1/3) */}
        <div className="space-y-6 sm:space-y-8">
          {/* Weekly Progress */}
          {isAuthenticated && isUnitsLoading ? (
            <SkeletonBlock className="h-64" />
          ) : (
            <WeeklyProgress activeDays={data.weeklyActiveDays} />
          )}

          {/* Activity Feed — panelde sadece yarım kalan testler gösteriliyor, tamamlananlar
              için zaten /panel/aktiviteler tam geçmişi var */}
          {isAuthenticated && isActivityLoading ? (
            <SkeletonBlock className="h-48" />
          ) : (
            <ActivityFeed
              activities={data.recentActivities.filter((a) => a.isComplete === false && !!a.resumeHref)}
              seeAllHref={isAuthenticated ? '/panel/aktiviteler' : undefined}
              title="Yarım Kalan Testler"
              emptyTitle="Yarım kalan test yok"
              emptySubtitle="Tüm testlerini tamamlamışsın, harika gidiyorsun!"
            />
          )}

          {/* Weekly Leaderboard */}
          <LeaderboardCard />
        </div>
      </div>

      {/* Quote/Footer Section */}
      <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-default p-4 sm:p-6 text-center">
        <p className="text-muted-foreground text-sm sm:text-base italic">
          "Öğrenme bir yolculuktur, bir varış noktası değil."
        </p>
        <p className="text-muted-foreground text-xs sm:text-sm mt-2">— Benjamin Franklin</p>
      </div>
    </PanelShell>
  );
}
