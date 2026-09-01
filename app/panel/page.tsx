'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useDashboardViewModel } from '../src/viewmodels/useDashboardViewModel';
import { Sidebar } from '../src/components/Sidebar';
import { TopBar } from '../src/components/TopBar';
import { StatsRow } from '../src/components/StatsRow';
import { SRSWidget } from '../src/components/SRSWidget';
import { ProgressCard } from '../src/components/ProgressCard';
import { WeeklyProgress } from '../src/components/WeeklyProgress';
import { ActivityFeed } from '../src/components/ActivityFeed';
import { DailyGoalCard } from '../src/components/DailyGoalCard';
import { AuthPrompt } from '../src/components/AuthPrompt';
import { navItems } from '../src/data/mockData';

export default function PanelPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    data,
    selectedWeekId,
    isLoading,
    isAuthenticated,
    notificationCount,
    unitsContext,
    canShiftWeekWindow,
    selectWeek,
    shiftWeekWindow,
    handleUnitClick,
    handleSRSReview,
    handleStartQuiz,
    markNotificationRead,
  } = useDashboardViewModel();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Glow Effects */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      {/* Sidebar */}
      <Sidebar
        items={navItems}
        activeItem="home"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAuthenticated={isAuthenticated}
        userName={data.user.name}
      />

      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="lg:ml-[280px] min-h-screen flex flex-col">
        {/* Top Bar */}
        <TopBar
          notificationCount={notificationCount}
          streak={data.user.streak}
          isAuthenticated={isAuthenticated}
          userName={data.user.name}
          onNotificationClick={markNotificationRead}
          onMenuClick={() => setSidebarOpen(true)}
          onStartQuiz={handleStartQuiz}
        />

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 relative">
          {/* Welcome Section */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-default mb-2">
              {isAuthenticated ? (
                <>Tekrar Hoşgeldin, <span className="gradient-text">{data.user.name}</span>! 👋</>
              ) : (
                <>Kişisel <span className="gradient-text">panelin</span> seni bekliyor 👋</>
              )}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
              Bugün öğrenme hedeflerine ulaşmak için harika bir gün. Hadi başlayalım!
            </p>
          </div>

          {isAuthenticated ? (
            <>
              {/* Daily Goal / CTA */}
              <div className="mb-6 sm:mb-8">
                <DailyGoalCard
                  dailyProgress={data.user.dailyProgress}
                  dailyGoal={data.user.dailyGoal}
                  streak={data.user.streak}
                  dueSrsCount={data.srsReview?.questionCount ?? 0}
                />
              </div>

              {/* Stats Row */}
              <div className="mb-6 sm:mb-8">
                <StatsRow stats={data.stats} />
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
              {data.srsReview && (
                <SRSWidget 
                  review={data.srsReview} 
                  onReview={handleSRSReview} 
                />
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
                    <button className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground hover:text-default transition-colors rounded-lg hover:bg-white/5 whitespace-nowrap">
                      Tümü
                    </button>
                    <button className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground hover:text-default transition-colors rounded-lg hover:bg-white/5 whitespace-nowrap">
                      Devam Edenler
                    </button>
                    <button className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted-foreground hover:text-default transition-colors rounded-lg hover:bg-white/5 whitespace-nowrap">
                      Tamamlananlar
                    </button>
                  </div>
                </div>
                
                {!isAuthenticated ? (
                  <AuthPrompt message="Ünitelerini ve ilerlemeni görmek için giriş yap." />
                ) : data.units.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {data.units.map((unit) => (
                      <ProgressCard
                        key={unit.id}
                        unit={unit}
                        onClick={() => handleUnitClick(unit.id)}
                      />
                    ))}
                  </div>
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
              <WeeklyProgress
                weeks={data.weeks}
                currentWeekId={selectedWeekId}
                onSelectWeek={selectWeek}
                onPrevWeeks={() => shiftWeekWindow(-1)}
                onNextWeeks={() => shiftWeekWindow(1)}
                canGoPrev={canShiftWeekWindow.prev}
                canGoNext={canShiftWeekWindow.next}
              />

              {/* Activity Feed */}
              <ActivityFeed activities={data.recentActivities} seeAllHref={isAuthenticated ? '/panel/aktiviteler' : undefined} />
            </div>
          </div>

          {/* Quote/Footer Section */}
          <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-default p-4 sm:p-6 text-center">
            <p className="text-muted-foreground text-sm sm:text-base italic">
              "Öğrenme bir yolculuktur, bir varış noktası değil."
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2">— Benjamin Franklin</p>
          </div>
        </main>
      </div>
    </div>
  );
}
