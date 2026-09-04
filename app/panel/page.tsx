'use client';

import React from 'react';
import { useDashboardViewModel } from '../src/viewmodels/useDashboardViewModel';
import { PanelShell } from '../src/components/PanelShell';
import { StatsRow } from '../src/components/StatsRow';
import { SRSWidget } from '../src/components/SRSWidget';
import { WeeklyProgress } from '../src/components/WeeklyProgress';
import { ActivityFeed } from '../src/components/ActivityFeed';
import { DailyGoalCard } from '../src/components/DailyGoalCard';
import { AuthPrompt } from '../src/components/AuthPrompt';
import { LeaderboardCard } from '../src/components/LeaderboardCard';
import { LessonExplorer } from '../src/components/LessonExplorer';

// Panel artık tek bir global spinnerla değil, her bölüm kendi verisi gelince ayrı ayrı
// dolduruluyor (bkz. kullanıcının "adım adım yüklensin, hepsini beklemeden" isteği,
// 2026-09-02) — bu, o bölümlerin yer tutucusu.
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl bg-white/5 animate-pulse ${className}`} />;
}

export default function PanelPage() {
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
      weeklyActiveDays={data.weeklyActiveDays}
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

          {/* Haftalık ilerleme (masaüstünde bunun yerine sidebar'da gösteriliyor — bkz.
              Sidebar.tsx; burada sadece mobilde, sidebar gizli olduğu için) */}
          <div className="lg:hidden mb-6 sm:mb-8">
            {isUnitsLoading ? <SkeletonBlock className="h-40" /> : <WeeklyProgress activeDays={data.weeklyActiveDays} />}
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

          {/* Dersler → Üniteler → Konular gezgini — tek bileşen, mobil/web aynı */}
          <div id="uniteler" className="scroll-mt-24">
            {!isAuthenticated ? (
              <AuthPrompt message="Derslerini ve ilerlemeni görmek için giriş yap." />
            ) : (
              <LessonExplorer
                lessons={data.lessons}
                isLessonsLoading={isUnitsLoading}
                units={data.units}
                topicsByUnitId={data.topicsByUnitId}
                activeUnitId={data.activeUnitId}
                isSwitchingLesson={isSwitchingLesson}
                gradeName={unitsContext?.gradeName ?? null}
                lessonName={unitsContext?.lessonName ?? null}
                onSelectLesson={selectLesson}
              />
            )}
          </div>
        </div>

        {/* Right Column - Activity & Leaderboard (1/3) */}
        <div className="space-y-6 sm:space-y-8">
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
