'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import logoIcon from '@/public/icons/icon-192.png';
import { useAuth } from '../context/AuthContext';
import { useProfileRole, useRealProfileRole } from '../hooks/useIsAdmin';
import { ViewAsMenu } from './ViewAsMenu';
import { useDisplayName } from '../hooks/useDisplayName';
import { getCurrentStreak } from '../lib/dashboardStreak';
import { NotificationBell } from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { HeaderMenu } from './HeaderMenu';
import { LegalFooter } from './LegalFooter';
import { ProfilePromptBanner } from './ProfilePromptBanner';
import { MemberPromptModal } from './MemberPromptModal';
import { DesktopNav, MobileTabBar, buildNavItems } from './SiteNav';
import { roboticFontVars } from './robotic/fonts';
import r from './robotic/robotic.module.css';
import { useMyGradeSlug } from '../hooks/useMyGradeSlug';

interface MainLayoutProps {
  children: React.ReactNode;
}

const GRADE_SEGMENT = /^\d+-sinif$/;

const LEGAL_INFO_ROUTES = new Set([
  '/gizlilik-politikasi',
  '/hakkimizda',
  '/iletisim',
  '/farkli-konular',
]);

const FOOTER_EXCLUDED_ROUTES = new Set([
  '/login',
  '/register',
  '/sifremi-unuttum',
  '/sifre-yenile',
  '/hesap-silme',
  '/banned',
  '/kavram-avi',
  '/ders/alt-baslik-test',
]);

export function MainLayout({ children }: MainLayoutProps) {
  const { isAuthenticated, user, realUser, viewAs, supabase, signOut } = useAuth();
  const role = useProfileRole();
  // Rol menüsü gerçek role göre: admin misafir/öğrenci görünümündeyken de menüye ulaşabilsin.
  const realRole = useRealProfileRole();
  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';
  const displayName = useDisplayName();
  const pathname = usePathname();
  const gradeSlug = useMyGradeSlug();
  const [streak, setStreak] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!user?.id) {
      setStreak(null);
      return;
    }
    getCurrentStreak(supabase, user.id).then(setStreak);
  }, [user?.id, supabase]);

  // Konu okuma sayfası (DersClient) kendi header'ını göstermiyor; global nav burada kalıyor.
  // Admin paneli ise hâlâ kendi sabit header/footer çerçevesini yönetir.
  // 4 segmentli diğer rotalar (/soru-bankasi/[sinif]/[ders]/[unite], /yazili-sorulari/[sinif]/[yazili]/[ders])
  // konu okuma sayfası olmadığı için ilk segmentin sınıf slug'ı (\d+-sinif) olması şart.
  const pathSegments = pathname?.split('/').filter(Boolean) ?? [];
  const isTopicContentRoute = pathSegments.length === 4 && GRADE_SEGMENT.test(pathSegments[0]);
  const isDersRoute = isTopicContentRoute;
  const isAdminRoute = pathname === '/admin' || pathname?.startsWith('/admin/');
  const isProgressRoute = pathname === '/ilerlemem' || pathname?.startsWith('/ilerlemem/');
  const isPersonalAppRoute =
    isProgressRoute ||
    pathname === '/profil' ||
    pathname?.startsWith('/profil/') ||
    pathname === '/ogretmen' ||
    pathname?.startsWith('/ogretmen/') ||
    pathname === '/tekrar' ||
    pathname?.startsWith('/sirali-test/') ||
    pathname?.startsWith('/uye/');
  const isLegalInfoRoute = pathname != null && LEGAL_INFO_ROUTES.has(pathname);
  const isFooterExcludedRoute = pathname != null && FOOTER_EXCLUDED_ROUTES.has(pathname);
  const hideHeader = pathname?.endsWith('/icerik') || isAdminRoute;
  // LegalFooter:
  // - Admin, konu okuma, kişisel uygulama, auth/sistem ve oyun sayfalarında herkese gizli.
  // - Giriş yapmış kullanıcılarda yasal/bilgi sayfaları dışında gizli (uygulama deneyimi).
  // - Misafir ve arama motorları için herkese açık SEO/içerik sayfalarında görünür kalır.
  const hideFooter =
    hideHeader ||
    isDersRoute ||
    isPersonalAppRoute ||
    isFooterExcludedRoute ||
    (isAuthenticated && !isLegalInfoRoute);
  // Mobil alt sekme çubuğu: yalnızca header gizli veya konu okuma sayfasındayken gizlenir
  // (/ilerlemem'de footer gizli olsa da alt sekme çubuğu görünmeye devam eder).
  const showTabBar = !hideHeader && !isDersRoute;
  const navItems = buildNavItems({ pathname: pathname ?? '/', isAuthenticated, isTeacher, gradeSlug });

  return (
    <div className={`min-h-screen bg-default ${showTabBar ? 'pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:pb-0' : ''}`}>
      {/* Header — her zaman sabit, scroll yönüne göre gizlenmez */}
      {!hideHeader && (
      <nav
        // Robotik tema (2026-10-19): metal cam çubuk + alt neon çizgi (bkz. robotic.module.css .siteBar).
        className={`fixed top-0 left-0 right-0 z-50 h-14 sm:h-[4.5rem] ${roboticFontVars} ${r.siteBar}`}
      >
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-2 px-3.5 sm:px-6 lg:px-5 xl:px-8">
          
          {/* Logo ve Site Adı + masaüstü menü */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 lg:gap-3 xl:gap-5">
            <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5 group active:scale-[0.98] transition-transform">
              {/* Logo */}
              {/* Gerçek Ders Takip logosu (favicon/PWA ikonuyla aynı), neon çerçeveli yuvarlak çipte. */}
              <div className={`w-9 h-9 sm:w-11 sm:h-11 !rounded-full p-0.5 ${r.brandChip}`} aria-label="Ders Takip anasayfa">
                <Image src={logoIcon} alt="" width={40} height={40} priority className="h-full w-full rounded-full" />
              </div>
              
              {/* Site Adı */}
              {/* 2026-10-21: giriş/tema/araçlar menüye taşındı, mobilde de site adı görünür (yalnız <340px gizli). */}
              <div className={`flex items-baseline gap-0.5 whitespace-nowrap ${r.brandText}`}>
                <span className={`text-[15px] sm:text-xl ${r.brandName}`}>
                  Ders Takip
                </span>
                <span className={`text-xs sm:text-sm ${r.brandTld}`}>
                  .net
                </span>
              </div>
            </Link>
            <DesktopNav items={navItems} />
          </div>

          {/* Sağ Menü — shrink-0 ile hiçbir ekran genişliğinde sağdan kırpılmaz */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 lg:gap-2 xl:gap-2.5">
            {/* 1024–1279px'te menü bağlantılarına yer açmak için seri gizli (İlerlemem'de görünüyor). */}
            {/* Öğretmen soru çözmüyor: seri sayacı yalnız öğrenci/admin'de (rol yüklenmeden öğretmene flash etmesin). */}
            {isAuthenticated && streak != null && role !== null && !isTeacher && (
              <div className={`flex lg:hidden xl:flex items-center gap-1.5 px-2.5 sm:px-3 h-9 sm:h-10 whitespace-nowrap ${r.metalChip}`} title={`${streak} günlük seri`}>
                <span className="text-base leading-none">🔥</span>
                <div className="leading-none">
                  <span className={`text-orange-500 text-sm sm:text-[15px] ${r.statValue}`}>{streak}</span>
                  <span className="hidden sm:inline text-muted-foreground text-xs ml-1">gün</span>
                </div>
              </div>
            )}

            {realRole === 'admin' && realUser && <ViewAsMenu userId={realUser.id} viewAs={viewAs} />}

            <NotificationBell />

            {/* Mobilde tema menünün içinde (yer dar); masaüstünde ayrı düğme. */}
            <ThemeToggle className="hidden lg:flex" />

            {!isAuthenticated && (
              <>
                <Link
                  href="/login"
                  className={`hidden sm:inline-flex text-sm px-3.5 py-2 rounded-xl whitespace-nowrap ${r.btnGhost} ${r.btnText}`}
                >
                  Giriş Yap
                </Link>
                <Link
                  href="/register"
                  className={`inline-flex items-center justify-center h-9 sm:h-auto px-3.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap active:scale-[0.98] ${r.btnNeon} ${r.btnText}`}
                >
                  <span className="sm:hidden">Kayıt Ol</span>
                  <span className="hidden sm:inline">Kayıt Ol</span>
                </Link>
              </>
            )}

            <HeaderMenu
              isAuthenticated={isAuthenticated}
              displayName={displayName || user?.email?.split('@')[0] || null}
              isAdmin={isAdmin}
              isTeacher={isTeacher}
              onSignOut={signOut}
            />
          </div>
        </div>
      </nav>
      )}

      {/* Ana İçerik */}
      <main className={hideHeader ? '' : 'pt-14 sm:pt-[4.5rem]'}>
        {!hideHeader && <ProfilePromptBanner />}
        {!hideHeader && <MemberPromptModal />}
        {children}
      </main>

      {!hideFooter && <LegalFooter />}
      {showTabBar && <MobileTabBar items={navItems} />}
    </div>
  );
}
