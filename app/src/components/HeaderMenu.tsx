'use client';

// Header menüsü (2026-10-21): misafirde "☰", üyede profil simgesi — tek bileşen, mobil ve masaüstü.
// Mobilde header'da yalnız logo + site adı + birkaç düğme kalsın diye giriş/kayıt, tema ve ikincil
// sayfalar (Araçlar) burada. Alt sekme çubuğundaki ana gezinme (Anasayfa, Dersler…) burada tekrarlanmaz.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, CalendarRange, ChevronRight, LogOut, Menu, MessageSquarePlus, Moon, Sun, Table2, UserRound, X, type LucideIcon } from 'lucide-react';
import { useThemeMode } from './ThemeToggle';
import { BottomSheet } from './ui/BottomSheet';
import { FeedbackSheet } from './feedback/FeedbackSheet';
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const [isMobileSheet, setIsMobileSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const syncMq = () => setIsMobileSheet(mq.matches);
    syncMq();
    mq.addEventListener('change', syncMq);
    return () => mq.removeEventListener('change', syncMq);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // BottomSheet document.body'ye portal edildiği için ref.current dışındadır;
      // mousedown'da kapatılırsa click olayı tetiklenmeden çekmece unmount olur (tema butonu vb. çalışmaz).
      if (target?.closest?.('[data-bottom-sheet="true"]')) return;
      if (ref.current && (!target || !ref.current.contains(target))) setOpenOn(null);
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
        className={`w-10 h-10 active:scale-95 ${r.iconBtn}`}
      >
        <TriggerIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>

      {open && isMobileSheet && (
        <BottomSheet
          open
          onClose={close}
          title={isAuthenticated ? (displayName || 'Hesabım') : 'Menü'}
          subtitle={isAuthenticated ? 'Hesap ve araçlar' : 'Ders Takip · Ücretsiz eğitim platformu'}
        >
          <div className="flex flex-col gap-3">
            {isAuthenticated ? (
              <div className={`overflow-hidden rounded-2xl border divide-y ${r.divider}`} style={{ background: 'var(--panel-solid)' }}>
                {!isTeacher && (
                  <Link href="/ilerlemem" onClick={close} className={`flex min-h-12 items-center justify-between px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}>
                    <span>İlerlemem</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                )}
                <Link href="/profil" onClick={close} className={`flex min-h-12 items-center justify-between px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}>
                  <span>Profil</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
                <Link href="/profil/ayarlar" onClick={close} className={`flex min-h-12 items-center justify-between px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}>
                  <span>Ayarlar</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
                <Link href="/profil/bildirdigim-sorular" onClick={close} className={`flex min-h-12 items-center justify-between px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}>
                  <span>Bildirdiğim sorular</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
                {(isTeacher || isAdmin) && (
                  <Link href="/ogretmen/yazili" onClick={close} className={`flex min-h-12 items-center justify-between px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}>
                    <span>Öğretmen Paneli</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin" onClick={close} className={`flex min-h-12 items-center justify-between px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}>
                    <span>Admin</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <Link href="/register" onClick={close} className={`flex min-h-12 items-center justify-center rounded-xl px-4 text-center text-sm font-bold active:scale-[0.98] ${r.btnNeon} ${r.btnText}`}>
                  Kayıt ol
                </Link>
                <Link href="/login" onClick={close} className={`flex min-h-12 items-center justify-center rounded-xl px-4 text-center text-sm font-bold active:scale-[0.98] ${r.btnGhost} ${r.btnText}`}>
                  Giriş yap
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              role="switch"
              aria-checked={isDark === true}
              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.item}`}
            >
              <span className="flex items-center gap-2.5">
                {isDark ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
                Koyu tema
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${isDark ? `${r.btnNeon} border-transparent` : 'border-[var(--edge)] bg-[var(--track)]'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-[22px]' : 'translate-x-1'}`} />
              </span>
            </button>

            <div className="space-y-1.5">
              <p className={`px-1 ${r.label}`}>Araçlar</p>
              <div className={`overflow-hidden rounded-2xl border divide-y ${r.divider}`} style={{ background: 'var(--panel-solid)' }}>
                {TOOLS.map(({ href, label, Icon }) => (
                  <Link key={href} href={href} onClick={close} className={`flex min-h-12 items-center gap-3 px-4 text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${r.accent}`} aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    close();
                    setFeedbackOpen(true);
                  }}
                  className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-default active:scale-[0.99] ${r.divider}`}
                >
                  <MessageSquarePlus className={`h-4 w-4 shrink-0 ${r.accent}`} aria-hidden="true" />
                  <span className="flex-1">Görüş & Hata Bildir</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </button>
              </div>
            </div>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  close();
                  onSignOut();
                }}
                className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-bold text-rose-600 dark:text-rose-400 active:scale-[0.98] ${r.item}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Çıkış yap
              </button>
            )}
          </div>
        </BottomSheet>
      )}

      {open && !isMobileSheet && (
        <div id="header-menu" className={`absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden ${r.menu}`}>
          {isAuthenticated ? (
            <>
              <div className={`px-4 py-3 border-b text-sm truncate ${r.divider} ${r.muted}`}>👋 {displayName}</div>
              {!isTeacher && <Link href="/ilerlemem" onClick={close} className={r.menuItem}>İlerlemem</Link>}
              <Link href="/profil" onClick={close} className={r.menuItem}>Profil</Link>
              <Link href="/profil/ayarlar" onClick={close} className={r.menuItem}>Ayarlar</Link>
              <Link href="/profil/bildirdigim-sorular" onClick={close} className={r.menuItem}>Bildirdiğim sorular</Link>
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
            <button
              type="button"
              onClick={() => {
                close();
                setFeedbackOpen(true);
              }}
              className={`${r.menuItem} !flex items-center gap-2.5`}
            >
              <MessageSquarePlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              Görüş & Hata Bildir
            </button>
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

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        variant={isTeacher ? 'teacher' : 'general'}
        source="header_menu"
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
