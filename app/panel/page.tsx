'use client';

import React, { useState } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      <Sidebar 
        items={navItems} 
        activeItem="home" 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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
          onNotificationClick={markNotificationRead}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 relative">
          {/* Welcome Section */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-default mb-2">
              Tekrar Hoşgeldin, <span className="gradient-text">Ali</span>! 👋
            </h1>
            <p className="text-muted text-sm sm:text-base lg:text-lg">
              Bugün öğrenme hedeflerine ulaşmak için harika bir gün. Hadi başlayalım!
            </p>
          </div>

          {/* Stats Row */}
          <div className="mb-6 sm:mb-8">
            <StatsRow stats={data.stats} />
          </div>

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
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                  <h2 className="text-lg sm:text-xl font-semibold text-default">Üniteler</h2>
                  <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
                    <button className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted hover:text-default transition-colors rounded-lg hover:bg-white/5 whitespace-nowrap">
                      Tümü
                    </button>
                    <button className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted hover:text-default transition-colors rounded-lg hover:bg-white/5 whitespace-nowrap">
                      Devam Edenler
                    </button>
                    <button className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-muted hover:text-default transition-colors rounded-lg hover:bg-white/5 whitespace-nowrap">
                      Tamamlananlar
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
            <div className="space-y-6 sm:space-y-8">
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
          <div className="rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-default p-4 sm:p-6 text-center">
            <p className="text-muted text-sm sm:text-base italic">
              "Öğrenme bir yolculuktur, bir varış noktası değil."
            </p>
            <p className="text-muted text-xs sm:text-sm mt-2">— Benjamin Franklin</p>
          </div>
        </main>
      </div>
    </div>
  );
}
