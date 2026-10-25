'use client';

// Header menüsü (2026-10-21): misafirde "☰", üyede profil simgesi — tek bileşen, mobil ve masaüstü.
// Mobilde header'da yalnız logo + site adı + birkaç düğme kalsın diye giriş/kayıt, tema ve ikincil
// sayfalar (Araçlar) burada. Alt sekme çubuğundaki ana gezinme (Anasayfa, Dersler…) burada tekrarlanmaz.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, CalendarRange, LogOut, Menu, Moon, Sun, Table2, UserRound, X, type LucideIcon } from 'lucide-react';
import { useThemeMode } from './ThemeToggle';
import r from './robotic/robotic.module.css';

const TOOLS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: '/ders-takip-cizelgesi', label: 'Ders Takip Çizelgesi', Icon: Table2 },
  { href: '/takdir-tesekkur-hesaplama', label: 'Takdir-Teşekkür Hesaplama', Icon: Calculator },
  { href: '/yillik-plan', label: 'Yıllık Plan', Icon: CalendarRange },
];

export function HeaderMenu({
  isAuthenticated,
  displayName,
  isAdmin,
  isTeacher,
  onSignOut,
}: {
  isAuthenticated: boolean;
  displayName: string | null;
  isAdmin: boolean;
  isTeacher: boolean;
  onSignOut: () => void;
}) {
  // Menü açıldığı sayfaya bağlı: sayfa değişince (geri tuşu dahil) kendiliğinden kapalı sayılır.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    setOpenOn((prev) => ((typeof v === 'function' ? v(prev === pathname) : v) ? pathname : null));
  const ref = useRef<HTMLDivElement>(null);
  const [isDark, toggleTheme] = useThemeMode();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenOn(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const TriggerIcon = open ? X : isAuthenticated ? UserRound : Menu;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="header-menu"
        aria-label={isAuthenticated ? 'Hesap menüsü' : 'Menü'}
        className={`w-9 h-9 sm:w-10 sm:h-10 ${r.iconBtn}`}
      >
        <TriggerIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>

      {open && (
        <div id="header-menu" className={`absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden ${r.menu}`}>
          {isAuthenticated ? (
            <>
              <div className={`px-4 py-3 border-b text-sm truncate ${r.divider} ${r.muted}`}>👋 {displayName}</div>
              <Link href="/ilerlemem" onClick={close} className={r.menuItem}>İlerlemem</Link>
              <Link href="/profil" onClick={close} className={r.menuItem}>Profil</Link>
              <Link href="/profil/ayarlar" onClick={close} className={r.menuItem}>Ayarlar</Link>
              {(isTeacher || isAdmin) && <Link href="/ogretmen/yazili" onClick={close} className={r.menuItem}>Öğretmen Paneli</Link>}
              {isAdmin && <Link href="/admin" onClick={close} className={r.menuItem}>Admin</Link>}
            </>
          ) : (
            <div className={`flex flex-col gap-2 border-b p-3 ${r.divider}`}>
              <Link href="/register" onClick={close} className={`rounded-xl px-4 py-2.5 text-center text-sm ${r.btnNeon} ${r.btnText}`}>
                Ücretsiz kayıt ol
              </Link>
              <Link href="/login" onClick={close} className={`rounded-xl px-4 py-2.5 text-center text-sm ${r.btnGhost} ${r.btnText}`}>
                Giriş yap
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark === true}
            className={`${r.menuItem} !flex items-center justify-between gap-3 border-t ${r.divider}`}
          >
            <span className="flex items-center gap-2.5">
              {isDark ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
              Koyu tema
            </span>
            <span
              aria-hidden="true"
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${isDark ? `${r.btnNeon} border-transparent` : 'border-[var(--edge)] bg-[var(--track)]'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </span>
          </button>

          <div className={`border-t py-1 ${r.divider}`}>
            <p className={`px-4 pb-1 pt-2 ${r.label}`}>Araçlar</p>
            {TOOLS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} onClick={close} className={`${r.menuItem} !flex items-center gap-2.5`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </div>

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                close();
                onSignOut();
              }}
              className={`${r.menuItem} !flex items-center gap-2.5 border-t hover:!text-red-500 ${r.divider}`}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Çıkış
            </button>
          )}
        </div>
      )}
    </div>
  );
}
