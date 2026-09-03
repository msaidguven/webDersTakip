'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { getCurrentStreak } from '../lib/dashboardStreak';
import { Icon } from './icons';
import { NotificationBell } from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { LegalFooter } from './LegalFooter';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, user, supabase, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const pathname = usePathname();
  const [streak, setStreak] = React.useState<number | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!user?.id) {
      setStreak(null);
      return;
    }
    getCurrentStreak(supabase, user.id).then(setStreak);
  }, [user?.id, supabase]);

  React.useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  React.useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [pathname]);
  // Konu okuma sayfası (DersClient) ve admin paneli kendi sabit header/footer
  // çerçevesini yönetir; bu yüzden global nav ve LegalFooter burada devre dışı
  // bırakılır. /ders?... rotası (query tabanlı) ve karşılık gelen
  // /[grade]/[lesson]/[unit]/[topic] pretty-URL rotası (DersClient içeriği
  // yüklendikten sonra history.replaceState ile bu formata geçiyor) aynı sayfa
  // olduğu için ikisi de eşleşmeli.
  const pathSegments = pathname?.split('/').filter(Boolean) ?? [];
  const isTopicContentRoute = pathSegments.length === 4;
  const isAdminRoute = pathname === '/admin' || pathname?.startsWith('/admin/');
  const hideHeader = pathname === '/ders' || pathname?.endsWith('/icerik') || isTopicContentRoute || isAdminRoute;
  // Test çözme sayfalarında (kavrama-testi/ünite-testi) header kalır ama footer'ın hukuki
  // linkleri odağı dağıtmasın diye gizlenir.
  const isTestPageRoute = pathname?.endsWith('/kavrama-testi') || pathname?.endsWith('/unite-testi');
  const hideFooter = hideHeader || isTestPageRoute;

  return (
    <div className="min-h-screen bg-default">
      {/* Header — her zaman sabit, scroll yönüne göre gizlenmez */}
      {!hideHeader && (
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-[60px] sm:h-[72px]
          bg-white/80 dark:bg-surface/95
          backdrop-blur-xl
          border-b border-zinc-200 dark:border-default
          shadow-sm dark:shadow-none"
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
            {isAuthenticated && streak != null && (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/20 rounded-xl">
                <span className="text-lg sm:text-xl">🔥</span>
                <div>
                  <span className="text-orange-400 font-bold text-sm sm:text-base">{streak}</span>
                  <span className="text-muted-foreground text-xs sm:text-sm ml-0.5 sm:ml-1">gün</span>
                </div>
              </div>
            )}

            <NotificationBell />

            <ThemeToggle />

            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen((open) => !open)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface border border-default flex items-center justify-center hover:bg-surface-elevated hover:border-default/20 transition-all"
                >
                  <Icon name="user" className="text-muted-foreground" size={18} />
                </button>

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 dark:border-default bg-white dark:bg-surface shadow-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-default text-sm text-zinc-500 dark:text-muted-foreground truncate">
                      👋 {user?.email?.split('@')[0]}
                    </div>
                    <Link
                      href="/panel"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="block text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-default
                        transition-colors text-sm px-4 py-2.5
                        hover:bg-zinc-100 dark:hover:bg-surface-elevated"
                    >
                      Panel
                    </Link>
                    <Link
                      href="/profil"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="block text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-default
                        transition-colors text-sm px-4 py-2.5
                        hover:bg-zinc-100 dark:hover:bg-surface-elevated"
                    >
                      Profil
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="block text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-default
                          transition-colors text-sm px-4 py-2.5
                          hover:bg-zinc-100 dark:hover:bg-surface-elevated"
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        signOut();
                      }}
                      className="w-full text-left text-zinc-600 dark:text-muted-foreground hover:text-red-600 dark:hover:text-red-400
                        transition-colors text-sm px-4 py-2.5
                        hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      Çıkış
                    </button>
                  </div>
                )}
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

      {!hideFooter && <LegalFooter />}
    </div>
  );
}
