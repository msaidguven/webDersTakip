'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Icon } from './icons';

interface PanelShellProps {
  isAuthenticated: boolean;
  userName?: string;
  title?: string;
  subtitle?: string;
  // Sadece panel anasayfası verir — sidebar'daki bir derse tıklandığında, sayfa
  // gezinmeden doğrudan o dersin ünite/konu listesine geçmek için (bkz. Sidebar).
  onSelectLesson?: (lessonId: string) => void;
  children: React.ReactNode;
}

// /panel'in kendi Sidebar kabuğu — /panel/aktiviteler ve /panel/siralama gibi alt
// sayfalarda da aynı navigasyonu tekrar yazmadan kullanmak için ayrıldı. Üst header
// artık site genelindeki tek header'dan (MainLayout) geliyor — burada panele özgü
// ikinci bir header yok, sadece mobilde Sidebar'ı açan bir menü düğmesi (+ varsa
// sayfaya özgü başlık) kalıyor.
export function PanelShell({ isAuthenticated, userName, title, subtitle, onSelectLesson, children }: PanelShellProps) {
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
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="lg:ml-[280px] min-h-screen flex flex-col">
        <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 rounded-xl bg-surface border border-default flex items-center justify-center text-muted-foreground hover:text-default hover:border-default/20 transition-all shrink-0"
          >
            <Icon name="menu" size={20} />
          </button>
          {title && (
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-default">{title}</h1>
              {subtitle && <p className="hidden sm:block text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          )}
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
