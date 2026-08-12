'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { LegalFooter } from './LegalFooter';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, user, signOut } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const pathname = usePathname();
  const hideHeader = pathname === '/ders' || pathname?.endsWith('/icerik');

  useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;
      
      // Sayfa en üstteyse her zaman göster
      if (currentScrollY < 10) {
        setIsVisible(true);
        return;
      }
      
      // Aşağı scroll edince gizle, yukarı scroll edince göster
      if (currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlNavbar, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', controlNavbar);
    };
  }, [lastScrollY]);

  return (
    <div className="min-h-screen bg-default">
      {/* Auto-hide Header */}
      {!hideHeader && (
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-[60px] sm:h-[72px]
          bg-white/80 dark:bg-surface/95 
          backdrop-blur-xl 
          border-b border-zinc-200 dark:border-default
          shadow-sm dark:shadow-none
          transition-all duration-300 ease-in-out
          ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-3 sm:px-8">
          
          {/* Logo ve Site Adı */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
              {/* Logo */}
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl 
                bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 
                flex items-center justify-center 
                shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/25 
                group-hover:shadow-indigo-500/40 
                transition-all group-hover:scale-105">
                <span className="text-lg sm:text-xl">🎓</span>
              </div>
              
              {/* Site Adı */}
              <div className="flex items-baseline gap-0.5">
                <span className="text-base sm:text-xl font-black tracking-tight 
                  bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 
                  dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 
                  bg-clip-text text-transparent">
                  Ders Takip
                </span>
                <span className="text-xs sm:text-sm font-bold text-indigo-500/70 dark:text-indigo-400/80">
                  .net
                </span>
              </div>
            </Link>
          </div>

          {/* Sağ Menü */}
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            
            {isAuthenticated ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-zinc-500 dark:text-muted-foreground text-xs sm:text-sm hidden md:block">
                  👋 {user?.email?.split('@')[0]}
                </span>
                <Link 
                  href="/profil" 
                  className="text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-default 
                    transition-colors text-xs sm:text-sm px-3 py-2 rounded-xl 
                    hover:bg-zinc-100 dark:hover:bg-surface-elevated"
                >
                  Profil
                </Link>
                <button 
                  onClick={signOut}
                  className="text-zinc-600 dark:text-muted-foreground hover:text-red-600 dark:hover:text-red-400 
                    transition-colors text-xs sm:text-sm px-3 py-2 rounded-xl 
                    hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  Çıkış
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link 
                  href="/login" 
                  className="text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-default 
                    transition-colors text-xs sm:text-sm px-3 py-2 rounded-xl 
                    hover:bg-zinc-100 dark:hover:bg-surface-elevated"
                >
                  Giriş Yap
                </Link>
                <Link 
                  href="/register"
                  className="px-3 sm:px-4 py-2 
                    bg-gradient-to-r from-indigo-500 to-purple-600 
                    text-white font-medium rounded-xl 
                    hover:shadow-lg hover:shadow-indigo-500/30 
                    transition-all text-xs sm:text-sm"
                >
                  <span className="sm:hidden">Kayıt</span>
                  <span className="hidden sm:inline">Kayıt Ol</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      )}

      {/* Ana İçerik */}
      <main className={hideHeader ? '' : 'pt-[60px] sm:pt-[72px]'}>
        {children}
      </main>

      {!hideHeader && <LegalFooter />}
    </div>
  );
}
