'use client';

// Rozetler (İlerlemem ve Üye Profil Kartı için TEK ortak bileşen — bkz. GEMINI.md Kural 5).
// Kurallar lib/badges.ts'te; mobilde 4 sütun kompakt ızgara, masaüstünde açıklamalı kartlar.
import { useMemo } from 'react';
import { CalendarCheck, Flame, Footprints, Lock, Trophy, type LucideIcon } from 'lucide-react';
import { useProgressActivity } from '@/app/src/hooks/useProgressActivity';
import { summarizeActivity } from '@/app/src/lib/progressActivity';
import { computeBadges, type Badge, type BadgeIcon } from '@/app/src/lib/badges';
import r from '../robotic/robotic.module.css';

const ICONS: Record<BadgeIcon, LucideIcon> = { first: Footprints, questions: Trophy, streak: Flame, days: CalendarCheck };

// Kazanılan rozetler her biri farklı renkte; kazanılmamışlar sakin gri.
const EARNED: Record<BadgeIcon, string> = {
  first: 'from-violet-500 to-indigo-600 shadow-violet-500/30',
  questions: 'from-amber-400 to-orange-500 shadow-orange-500/30',
  streak: 'from-rose-500 to-fuchsia-600 shadow-rose-500/30',
  days: 'from-emerald-400 to-teal-500 shadow-emerald-500/30',
};

export interface BadgesListProps {
  badges: Badge[] | null;
  title?: string;
  headingId?: string;
  /** Başka bir üyenin kartında kilitli rozetlerin ham eksik sayıları gizlenir, kendi ekranında ilerleme çubuğu gösterilir. */
  hideLockedProgress?: boolean;
}

export function BadgesList({
  badges,
  title = 'Rozetlerim',
  headingId = 'rozetlerim',
  hideLockedProgress = false,
}: BadgesListProps) {
  const earnedCount = badges?.filter((b) => b.earned).length ?? 0;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className={`scroll-mt-28 text-lg font-bold tracking-tight text-default uppercase sm:text-xl ${r.display}`}>
          {title}
        </h2>
        {badges && (
          <span className={r.badge}>
            {earnedCount} / {badges.length} kazanıldı
          </span>
        )}
      </div>

      {!badges ? (
        <div aria-busy="true" aria-label="Rozetler yükleniyor" className="h-40 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:gap-3">
          {badges.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <li
                key={b.id}
                title={b.description}
                className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center sm:gap-2 sm:rounded-2xl sm:p-3 ${
                  b.earned
                    ? `bg-gradient-to-br text-white shadow-md sm:shadow-lg ${EARNED[b.icon]}`
                    : r.panel
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${
                    b.earned ? 'bg-white/25' : r.chipBox
                  }`}
                >
                  {b.earned || !hideLockedProgress ? (
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-75" aria-hidden="true" />
                  )}
                </span>
                <span className={`text-[11px] font-semibold leading-tight sm:text-sm ${b.earned ? 'text-white' : 'text-default'}`}>
                  {b.title}
                </span>
                {b.earned ? (
                  <span className="hidden text-xs text-white/85 sm:inline">{b.description}</span>
                ) : hideLockedProgress ? (
                  <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">Kilitli</span>
                ) : (
                  <>
                    <span className={`block h-1 w-full sm:h-1.5 ${r.track}`} role="img" aria-label={`İlerleme: ${b.progressLabel}`}>
                      <span className={`block ${r.fill}`} style={{ width: `${b.progress}%` }} />
                    </span>
                    <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">{b.progressLabel}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function Badges() {
  const { data, error } = useProgressActivity();
  const badges = useMemo(() => (data ? computeBadges(summarizeActivity(data)) : null), [data]);

  if (error) return null;

  return <BadgesList badges={badges} title="Rozetlerim" headingId="rozetlerim" />;
}
