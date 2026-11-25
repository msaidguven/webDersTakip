'use client';

// Mobilde native uygulama hissi veren alttan açılır çekmece (Bottom Sheet).
// Portal ile document.body'ye render edilir; hiçbir üst kapsayıcı tarafından kırpılmaz.
import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDismissOnBack } from '@/app/src/hooks/useDismissOnBack';
import { roboticFontVars } from '../robotic/fonts';
import r from '../robotic/robotic.module.css';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, subtitle, badge, icon, footer, children }: BottomSheetProps) {
  const titleId = useId();
  useDismissOnBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-bottom-sheet="true"
      className={`fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4 ${roboticFontVars} ${r.themeVars}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      {/* Karartma arka planı */}
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-[3px] transition-opacity"
      />

      {/* Çekmece gövdesi */}
      <div
        className={`relative z-10 flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-b-0 sm:rounded-[24px] sm:border-b ${r.sheetEnter}`}
        style={{
          background: 'var(--bg)',
          borderColor: 'var(--edge)',
          boxShadow: '0 -16px 48px -12px rgba(15, 23, 42, 0.42)',
        }}
      >
        {/* İnce robotik üst vurgu çizgisi */}
        <div
          aria-hidden="true"
          className="h-[2px] w-full shrink-0"
          style={{ background: 'linear-gradient(90deg, transparent, var(--neon-2) 25%, var(--neon) 65%, transparent)' }}
        />

        {/* Mobil tutamaç + Üst başlık çubuğu */}
        <div
          className="shrink-0 border-b px-4 pb-3.5 pt-2 sm:px-5 sm:pt-4"
          style={{ background: 'var(--panel-solid)', borderColor: 'var(--edge)' }}
        >
          <div className="mb-2.5 flex justify-center sm:hidden" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-slate-300/90 dark:bg-slate-600" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {icon && (
                <span className={`h-10 w-10 shrink-0 rounded-2xl ${r.chipBox}`} aria-hidden="true">
                  {icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id={titleId} className="truncate text-[16px] font-extrabold leading-tight text-default">
                    {title}
                  </h2>
                  {badge && <span className={r.badge}>{badge}</span>}
                </div>
                {subtitle && <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className={`h-10 w-10 shrink-0 active:scale-95 ${r.iconBtn}`}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Kaydırılabilir içerik */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 sm:px-5 ${
            footer ? 'pb-4' : 'pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:pb-5'
          }`}
        >
          {children}
        </div>

        {/* İsteğe bağlı sabit alt aksiyon çubuğu */}
        {footer && (
          <div
            className="shrink-0 border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4"
            style={{ background: 'var(--panel-solid)', borderColor: 'var(--edge)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
