'use client';

import React from 'react';
import { useDashboardViewModel } from '../src/viewmodels/useDashboardViewModel';
import { Sidebar } from '../src/components/Sidebar';
import { TopBar } from '../src/components/TopBar';
import { StatsRow } from '../src/components/StatsRow';
import { SRSWidget } from '../src/components/SRSWidget';
import { ProgressCard } from '../src/components/ProgressCard';
import { WeeklyProgress } from '../src/components/WeeklyProgress';
import { ActivityFeed } from '../src/components/ActivityFeed';
import { navItems } from '../src/data/mockData';

export default function PanelPage() {
  const {
    data,
    selectedWeekId,
    notificationCount,
    selectWeek,
    handleUnitClick,
    handleSRSReview,
    markNotificationRead,
  } = useDashboardViewModel();

  return (
    <div className="min-h-screen bg-background bg-grid">
      {/* Glow Effects */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      
      {/* Sidebar */}
      <Sidebar items={navItems} activeItem="home" />

      {/* Main Content Area */}
      <div className="ml-[280px] min-h-screen flex flex-col">
        {/* Top Bar */}
        <TopBar 
          notificationCount={notificationCount}
          streak={data.user.streak}
          onNotificationClick={markNotificationRead}
        />

        {/* Dashboard Content */}
        <main className="flex-1 p-8 relative">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Tekrar Hoşgeldin, <span className="gradient-text">Ali</span>! 👋
            </h1>
            <p className="text-zinc-400 text-lg">
              Bugün öğrenme hedeflerine ulaşmak için harika bir gün. Hadi başlayalım!
            </p>
          </div>

          {/* Stats Row */}
          <div className="mb-8">
            <StatsRow stats={data.stats} />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-3 gap-8 mb-8">
            {/* Left Column - SRS & Units (2/3) */}
            <div className="col-span-2 space-y-8">
              {/* SRS Alert */}
              {data.srsReview && (
                <SRSWidget 
                  review={data.srsReview} 
                  onReview={handleSRSReview} 
                />
              )}

              {/* Units Section */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white">Üniteler</h2>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                      Tümü
                    </button>
                    <button className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                      Devam Edenler
                    </button>
                    <button className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                      Tamamlananlar
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  {data.units.map((unit) => (
                    <ProgressCard
                      key={unit.id}
                      unit={unit}
                      onClick={() => handleUnitClick(unit.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Weekly & Activity (1/3) */}
            <div className="space-y-8">
              {/* Weekly Progress */}
              <WeeklyProgress 
                weeks={data.weeks}
                currentWeekId={selectedWeekId}
                onSelectWeek={selectWeek}
              />

              {/* Activity Feed */}
              <ActivityFeed activities={data.recentActivities} />
            </div>
          </div>

          {/* Quote/Footer Section */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-white/5 p-6 text-center">
            <p className="text-zinc-400 italic">
              "Öğrenme bir yolculuktur, bir varış noktası değil."
            </p>
            <p className="text-zinc-500 text-sm mt-2">— Benjamin Franklin</p>
          </div>
        </main>
      </div>
    </div>
  );
}
