'use client';

// Admin'e özel header menüsü (2026-11-17): siteyi hangi rolde göreceğini seçer; seçim değiştirilene kadar
// her sayfada geçerli (bkz. lib/viewAs.ts). Admin dışında hiç görünmez. Admin olmayan bir rol seçiliyken
// düğme amber renkte ve rol adını gösterir — admin farklı bir görünümde olduğunu unutmasın.
import { useEffect, useRef, useState } from 'react';
import { Check, Eye, GraduationCap, Presentation, ShieldCheck, UserRound } from 'lucide-react';
import { setViewAs, VIEW_AS_LABEL, type ViewAsRole } from '../lib/viewAs';
import r from './robotic/robotic.module.css';

const OPTIONS: { role: ViewAsRole | null; label: string; hint: string; Icon: typeof Eye }[] = [
  { role: null, label: VIEW_AS_LABEL.admin, hint: 'Kendi görünümün', Icon: ShieldCheck },
  { role: 'student', label: VIEW_AS_LABEL.student, hint: 'Kendi ilerleme verinle', Icon: GraduationCap },
  { role: 'teacher', label: VIEW_AS_LABEL.teacher, hint: 'Öğretmen anasayfası ve menüsü', Icon: Presentation },
  { role: 'guest', label: VIEW_AS_LABEL.guest, hint: 'Giriş yapmamış ziyaretçi', Icon: UserRound },
];

export function ViewAsMenu({ userId, viewAs }: { userId: string; viewAs: ViewAsRole | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = viewAs !== null;
  const current = VIEW_AS_LABEL[viewAs ?? 'admin'];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="view-as-menu"
        aria-label={`Görünüm: ${current}. Rol değiştir`}
        title="Siteyi hangi rolde göreceğini seç"
        className={
          active
            ? 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-500/60 bg-amber-500/15 px-2.5 text-xs font-bold text-amber-700 sm:h-10 sm:text-sm dark:text-amber-300'
            : `w-9 h-9 sm:w-10 sm:h-10 ${r.iconBtn}`
        }
      >
        <Eye className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {active && <span className="hidden sm:inline">{current}</span>}
      </button>

      {open && (
        <div id="view-as-menu" className={`absolute right-0 mt-2 w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden ${r.menu}`}>
          <p className={`px-4 pb-1 pt-3 ${r.label}`}>Siteyi şu rolde gör</p>
          {OPTIONS.map(({ role, label, hint, Icon }) => {
            const selected = role === viewAs;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setViewAs(userId, role);
                  setOpen(false);
                }}
                className={`${r.menuItem} !flex w-full items-center gap-3 text-left`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{label}</span>
                  <span className={`text-xs ${r.muted}`}>{hint}</span>
                </span>
                {selected && <Check className={`h-4 w-4 shrink-0 ${r.accent}`} aria-hidden="true" />}
              </button>
            );
          })}
          <p className={`border-t px-4 py-2.5 text-xs ${r.divider} ${r.muted}`}>Yalnız görünüm değişir; yetkilerin aynı kalır.</p>
        </div>
      )}
    </div>
  );
}
