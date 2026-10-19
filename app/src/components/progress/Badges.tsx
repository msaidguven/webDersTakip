'use client';

// Rozetlerim (İlerlemem, yol haritası 4i). Kurallar lib/badges.ts'te; veri özet kartıyla aynı
// SWR önbelleğinden (get_my_daily_activity) — ek istek yok.
import { useMemo } from 'react';
import { CalendarCheck, Flame, Footprints, Trophy, type LucideIcon } from 'lucide-react';
import { useProgressActivity } from '@/app/src/hooks/useProgressActivity';
import { summarizeActivity } from '@/app/src/lib/progressActivity';
import { computeBadges, type BadgeIcon } from '@/app/src/lib/badges';
import r from '../robotic/robotic.module.css';

const ICONS: Record<BadgeIcon, LucideIcon> = { first: Footprints, questions: Trophy, streak: Flame, days: CalendarCheck };

// Kazanılan rozetler her biri farklı renkte; kazanılmamışlar sakin gri.
const EARNED: Record<BadgeIcon, string> = {
  first: 'from-violet-500 to-indigo-600 shadow-violet-500/30',
  questions: 'from-amber-400 to-orange-500 shadow-orange-500/30',
  streak: 'from-rose-500 to-fuchsia-600 shadow-rose-500/30',
  days: 'from-emerald-400 to-teal-500 shadow-emerald-500/30',
};

export function Badges() {
  const { data, error } = useProgressActivity();
  const badges = useMemo(() => (data ? computeBadges(summarizeActivity(data)) : null), [data]);

  if (error) return null;

  const earnedCount = badges?.filter((b) => b.earned).length ?? 0;

  return (
    <section aria-labelledby="rozetlerim" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="rozetlerim" className={`scroll-mt-28 text-lg font-bold tracking-tight text-default uppercase sm:text-xl ${r.display}`}>
          Rozetlerim
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <li
                key={b.id}
                className={`flex flex-col items-center gap-2 rounded-2xl p-3 text-center ${
                  b.earned
                    ? `bg-gradient-to-br text-white shadow-lg ${EARNED[b.icon]}`
                    : r.panel
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    b.earned ? 'bg-white/25' : r.chipBox
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={`text-sm font-semibold ${b.earned ? 'text-white' : 'text-default'}`}>{b.title}</span>
                {b.earned ? (
                  <span className="text-xs text-white/85">{b.description}</span>
                ) : (
                  <>
                    <span className={`block h-1.5 w-full ${r.track}`} role="img" aria-label={`İlerleme: ${b.progressLabel}`}>
                      <span className={`block ${r.fill}`} style={{ width: `${b.progress}%` }} />
                    </span>
                    <span className="text-xs text-muted-foreground">{b.progressLabel}</span>
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
