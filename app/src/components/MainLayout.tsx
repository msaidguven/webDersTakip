'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useDisplayName } from '../hooks/useDisplayName';
import { getCurrentStreak } from '../lib/dashboardStreak';
import { Icon } from './icons';
import { NotificationBell } from './NotificationBell';
import { AdminPageRefresh } from './AdminPageRefresh';
import ThemeToggle from './ThemeToggle';
import { LegalFooter } from './LegalFooter';
import { ProfilePromptBanner } from './ProfilePromptBanner';
import { DesktopNav, MobileTabBar, buildNavItems } from './SiteNav';
import { roboticFontVars } from './robotic/fonts';
import r from './robotic/robotic.module.css';
import { useMyGradeSlug } from '../hooks/useMyGradeSlug';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, user, supabase, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const displayName = useDisplayName();
  const pathname = usePathname();
  const gradeSlug = useMyGradeSlug();
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
  // Konu okuma sayfası (DersClient) artık kendi header'ını göstermiyor; global nav
  // burada kalıyor (bkz. kullanıcının 2026-09-05 isteği). Admin paneli ise hâlâ kendi
  // sabit header/footer çerçevesini yönetir. /ders?... rotası (query tabanlı) ve
  // karşılık gelen /[grade]/[lesson]/[unit]/[topic] pretty-URL rotası (DersClient
  // içeriği yüklendikten sonra history.replaceState ile bu formata geçiyor) aynı sayfa
  // olduğu için ikisi de eşleşmeli.
  const pathSegments = pathname?.split('/').filter(Boolean) ?? [];
  const isTopicContentRoute = pathSegments.length === 4;
  const isDersRoute = isTopicContentRoute;
  const isAdminRoute = pathname === '/admin' || pathname?.startsWith('/admin/');
  const hideHeader = pathname?.endsWith('/icerik') || isAdminRoute;
  // Test çözme sayfalarında (kavrama-testi/ünite-testi) header kalır ama footer'ın hukuki
  // linkleri odağı dağıtmasın diye gizlenir. Ders sayfası da kendi Geri/İleri footer'ını
  // yönettiği için LegalFooter'ı burada gizli tutuyoruz (global header'ı gösterse bile).
  const isTestPageRoute = pathname?.endsWith('/kavrama-testi') || pathname?.endsWith('/unite-testi');
  const hideFooter = hideHeader || isDersRoute || isTestPageRoute;
  // Mobil alt sekme çubuğu: konu okuma sayfasının kendi sabit Geri/İleri çubuğu ve test
  // sayfaları varken gösterilmez (footer ile aynı kural) — üst üste iki alt çubuk olmasın.
  const showTabBar = !hideFooter;
  const navItems = buildNavItems({ pathname: pathname ?? '/', isAuthenticated, gradeSlug });

  return (
    <div className={`min-h-screen bg-default ${showTabBar ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0' : ''}`}>
      {/* Header — her zaman sabit, scroll yönüne göre gizlenmez */}
      {!hideHeader && (
      <nav
        // Robotik tema (2026-10-19): metal cam çubuk + alt neon çizgi (bkz. robotic.module.css .siteBar).
        className={`fixed top-0 left-0 right-0 z-50 h-[60px] sm:h-[72px] ${roboticFontVars} ${r.siteBar}`}
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-3 sm:px-8">
          
          {/* Logo ve Site Adı + masaüstü menü */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-6">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
              {/* Logo */}
              {/* Gerçek Ders Takip logosu (favicon/PWA ikonuyla aynı), neon çerçeveli yuvarlak çipte. */}
              <div className={`w-9 h-9 sm:w-11 sm:h-11 !rounded-full p-0.5 ${r.brandChip}`} aria-label="Ders Takip anasayfa">
                <Image src="/icons/icon-192.png" alt="" width={40} height={40} priority className="h-full w-full rounded-full" />
              </div>
              
              {/* Site Adı */}
              {/* 430px altında yalnız logo: sağdaki düğmeler (Giriş/Kayıt ya da seri+profil) sığsın. */}
              <div className={`flex items-baseline gap-0.5 whitespace-nowrap ${r.brandText}`}>
                <span className={`text-base sm:text-xl ${r.brandName}`}>
                  Ders Takip
                </span>
                <span className={`text-xs sm:text-sm ${r.brandTld}`}>
                  .net
                </span>
              </div>
            </Link>
            <DesktopNav items={navItems} />
          </div>

          {/* Sağ Menü */}
          <div className="flex items-center gap-2 sm:gap-4">
            {isAuthenticated && streak != null && (
              <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 ${r.metalChip}`}>
                <span className="text-lg sm:text-xl">🔥</span>
                <div>
                  <span className={`text-orange-500 text-sm sm:text-base ${r.statValue}`}>{streak}</span>
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
                  className={`w-9 h-9 sm:w-10 sm:h-10 ${r.iconBtn}`}
                >
                  <Icon name="user" size={18} />
                </button>

                {isProfileMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-56 overflow-hidden ${r.menu}`}>
                    <div className={`px-4 py-3 border-b text-sm truncate ${r.divider} ${r.muted}`}>
                      👋 {displayName || user?.email?.split('@')[0]}
                    </div>
                    <Link
                      href="/ilerlemem"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className={r.menuItem}
                    >
                      İlerlemem
                    </Link>
                    <Link
                      href="/profil"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className={r.menuItem}
                    >
                      Profil
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className={r.menuItem}
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        signOut();
                      }}
                      className={`${r.menuItem} hover:!text-red-500`}
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
                  className={`text-xs sm:text-sm px-2.5 sm:px-3.5 py-2 rounded-xl whitespace-nowrap ${r.btnGhost} ${r.btnText}`}
                >
                  Giriş Yap
                </Link>
                <Link 
                  href="/register"
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm ${r.btnNeon} ${r.btnText}`}
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
        {!hideHeader && <ProfilePromptBanner />}
        {children}
      </main>

      {!hideFooter && <LegalFooter />}
      {showTabBar && <MobileTabBar items={navItems} />}
      <AdminPageRefresh />
    </div>
  );
}
