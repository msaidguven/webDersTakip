'use client';

// Site geneli gezinme (2026-09-28): eskiden header'da hiç menü yoktu, öğrenci anasayfa dışında
// bir sayfadayken derslere/soru bankasına tek tıkla dönemiyordu. Masaüstünde header'da yazı
// linkleri, mobilde altta sabit sekme çubuğu. Her hedefin HER YERDE tek adı var
// (bilgi mimarisi kuralı): Anasayfa, Dersler, Soru Bankası, İlerlemem.
import Link from 'next/link';
import { BookOpen, ChartNoAxesColumn, Home, PencilLine, type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: 'home' | 'lessons' | 'questions' | 'progress';
  label: string;
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
  ];
  if (isAuthenticated) {
    items.push({ id: 'progress', label: 'İlerlemem', href: '/ilerlemem', icon: ChartNoAxesColumn, active: first === 'ilerlemem' });
  }
  return items;
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  return (
    <ul className="hidden items-center gap-1 md:flex">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors lg:px-3.5 ${
              item.active
                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-muted-foreground dark:hover:bg-surface-elevated dark:hover:text-default'
            }`}
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-default dark:bg-surface/95 md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ id, label, href, icon: Icon, active }) => (
          <li key={id} className="flex-1">
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors ${
                active ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-500 dark:text-muted-foreground'
              }`}
            >
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-indigo-500/15' : ''}`}>
                <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
