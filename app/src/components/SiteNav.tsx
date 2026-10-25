'use client';

// Site geneli gezinme (2026-09-28): eskiden header'da hiç menü yoktu, öğrenci anasayfa dışında
// bir sayfadayken derslere/soru bankasına tek tıkla dönemiyordu. Masaüstünde header'da yazı
// linkleri, mobilde altta sabit sekme çubuğu. Her hedefin HER YERDE tek adı var
// (bilgi mimarisi kuralı): Anasayfa, Dersler, Soru Bankası, Yazılı Soruları, İlerlemem.
import Link from 'next/link';
import { BookOpen, ChartNoAxesColumn, ClipboardList, Home, PencilLine, Table2, type LucideIcon } from 'lucide-react';
import { roboticFontVars } from './robotic/fonts';
import r from './robotic/robotic.module.css';

export interface NavItem {
  id: 'home' | 'lessons' | 'questions' | 'exams' | 'progress' | 'chart';
  label: string;
  /** Alt sekme çubuğunda yer dar: kısa etiket (erişilebilir ad yine tam etiket). */
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
}

const GRADE_SEGMENT = /^\d+-sinif$/;

export function buildNavItems({
  pathname,
  isAuthenticated,
  gradeSlug,
}: {
  pathname: string;
  isAuthenticated: boolean;
  gradeSlug: string | null;
}): NavItem[] {
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  const items: NavItem[] = [
    { id: 'home', label: 'Anasayfa', href: '/', icon: Home, active: pathname === '/' },
    {
      id: 'lessons',
      label: 'Dersler',
      // Sınıf sayfası tüm dersleri ve konu anlatımlarını listeliyor; sınıfı bilinmeyen için
      // anasayfadaki sınıf/ders seçici (misafir görünümü) ya da profil (sınıf seçimi).
      href: gradeSlug ? `/${gradeSlug}` : isAuthenticated ? '/profil' : '/#dersler',
      icon: BookOpen,
      active: GRADE_SEGMENT.test(first) || first === 'ders',
    },
    {
      id: 'questions',
      label: 'Soru Bankası',
      href: gradeSlug ? `/soru-bankasi/${gradeSlug}` : '/soru-bankasi',
      icon: PencilLine,
      active: first === 'soru-bankasi',
    },
    // Yazılı soruları (2026-10-21): sınıf bilinse de dizin — yazılılar sınıf/ders kırılımıyla orada.
    { id: 'exams', label: 'Yazılı Soruları', shortLabel: 'Yazılı', href: '/yazili-sorulari', icon: ClipboardList, active: first === 'yazili-sorulari' },
  ];
  // Ders takip çizelgesi (herkese açık): yalnız masaüstü header'ında; alt sekme çubuğunda yer yok.
  items.push({
    id: 'chart',
    label: 'Ders Takip Çizelgesi',
    href: '/ders-takip-cizelgesi',
    icon: Table2,
    active: pathname.startsWith('/ders-takip-cizelgesi'),
  });
  if (isAuthenticated) {
    items.push({ id: 'progress', label: 'İlerlemem', href: '/ilerlemem', icon: ChartNoAxesColumn, active: first === 'ilerlemem' });
  }
  return items;
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  return (
    <ul className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (
        // Uzun etiket (çizelge) header'ı sıkıştırmasın diye yalnız çok geniş ekranda (Yazılı Soruları
        // eklenince 1280px'te girişli header taşıyordu, 2026-10-21).
        <li key={item.id} className={item.id === 'chart' ? 'hidden 2xl:block' : undefined}>
          <Link
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`${r.navLink} ${item.active ? r.navActive : ''}`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MobileTabBar({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Ana menü"
      className={`fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden ${roboticFontVars} ${r.tabBar}`}
    >
      <ul className="mx-auto flex max-w-lg">
        {items.filter((item) => item.id !== 'chart').map(({ id, label, shortLabel, href, icon: Icon, active }) => (
          <li key={id} className="flex-1">
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={shortLabel ? label : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${r.tabItem} ${active ? r.tabItemActive : ''}`}
            >
              <span className={`flex h-7 w-12 items-center justify-center ${r.tabPill}`}>
                <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
              </span>
              {shortLabel ?? label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
