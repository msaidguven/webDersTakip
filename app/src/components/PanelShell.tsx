'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface PanelShellProps {
  isAuthenticated: boolean;
  userName?: string;
  streak?: number;
  notificationCount?: number;
  title?: string;
  subtitle?: string;
  onNotificationClick?: () => void;
  onStartQuiz?: () => void;
  // Sadece panel anasayfası verir — sidebar'daki bir derse tıklandığında, sayfa
  // gezinmeden doğrudan o dersin ünite/konu listesine geçmek için (bkz. Sidebar).
  onSelectLesson?: (lessonId: string) => void;
  children: React.ReactNode;
}

// /panel'in kendi Sidebar + TopBar kabuğu — /panel/aktiviteler ve /panel/siralama gibi
// alt sayfalarda da aynı navigasyonu (ve dolayısıyla panel ⟷ profil arası kolay geçişi)
// tekrar yazmadan kullanmak için ayrıldı.
export function PanelShell({
  isAuthenticated,
  userName,
  streak,
  notificationCount = 0,
  title,
  subtitle,
  onNotificationClick,
  onStartQuiz,
  onSelectLesson,
  children,
}: PanelShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background bg-grid">
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAuthenticated={isAuthenticated}
        userName={userName}
        onSelectLesson={onSelectLesson}
      />

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="lg:ml-[280px] min-h-screen flex flex-col">
        <TopBar
          notificationCount={notificationCount}
          streak={streak}
          isAuthenticated={isAuthenticated}
          userName={userName}
          title={title}
          subtitle={subtitle}
          onNotificationClick={onNotificationClick ?? (() => {})}
          onMenuClick={() => setSidebarOpen(true)}
          onStartQuiz={onStartQuiz}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
