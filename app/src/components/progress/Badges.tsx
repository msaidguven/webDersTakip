'use client';

// Rozetlerim (İlerlemem, yol haritası 4i). Kurallar lib/badges.ts'te; veri özet kartıyla aynı
// SWR önbelleğinden (get_my_daily_activity) — ek istek yok.
import { useMemo } from 'react';
import { CalendarCheck, Flame, Footprints, Trophy, type LucideIcon } from 'lucide-react';
import { useProgressActivity } from '@/app/src/hooks/useProgressActivity';
import { summarizeActivity } from '@/app/src/lib/progressActivity';
import { computeBadges, type BadgeIcon } from '@/app/src/lib/badges';

const ICONS: Record<BadgeIcon, LucideIcon> = { first: Footprints, questions: Trophy, streak: Flame, days: CalendarCheck };

export function Badges() {
  const { data, error } = useProgressActivity();
  const badges = useMemo(() => (data ? computeBadges(summarizeActivity(data)) : null), [data]);

  if (error) return null;

  const earnedCount = badges?.filter((b) => b.earned).length ?? 0;

  return (
    <section aria-labelledby="rozetlerim" className="flex flex-col gap-4 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="rozetlerim" className="scroll-mt-28 text-lg font-extrabold text-default sm:text-xl">
          Rozetlerim
        </h2>
        {badges && (
          <span className="text-sm font-bold text-muted-foreground">
            {earnedCount} / {badges.length} kazanıldı
          </span>
        )}
      </div>

      {!badges ? (
        <div aria-busy="true" aria-label="Rozetler yükleniyor" className="h-40 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {badges.map((b) => {
            const Icon = ICONS[b.icon];
            return (
              <li
                key={b.id}
                className={`flex flex-col items-center gap-2 rounded-2xl p-3 text-center sm:p-4 ${
                  b.earned ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'border border-dashed border-default'
                }`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    b.earned ? 'bg-indigo-600 text-white' : 'bg-surface-elevated text-muted-foreground'
                  }`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className={`text-sm font-extrabold ${b.earned ? 'text-default' : 'text-muted-foreground'}`}>{b.title}</span>
                {b.earned ? (
                  <span className="text-xs text-muted-foreground">{b.description}</span>
                ) : (
                  <>
                    <span
                      className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated"
                      role="img"
                      aria-label={`İlerleme: ${b.progressLabel}`}
                    >
                      <span className="block h-full rounded-full bg-indigo-400" style={{ width: `${b.progress}%` }} />
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
