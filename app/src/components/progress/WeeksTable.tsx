'use client';

// "Son 4 hafta" tablosu (İlerlemem, yol haritası 4d). Isı haritası BİLİNÇLİ olarak yok —
// kullanıcı: ortaokul öğrencisine karışık geliyor. Hafta başına tek satır: çalışılan günler
// nokta, yanında soru sayısı ve doğruluk.
import { useMemo } from 'react';
import { useProgressActivity } from '@/app/src/hooks/useProgressActivity';
import { lastWeeks, type DayState } from '@/app/src/lib/progressActivity';

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const DAY_INITIALS = ['P', 'S', 'Ç', 'P', 'C', 'C', 'P'];
const STATE_TEXT: Record<DayState, string> = { done: 'soru çözdün', missed: 'çözmedin', future: 'henüz gelmedi' };
const DOT: Record<DayState, string> = {
  done: 'bg-indigo-600 dark:bg-indigo-400',
  missed: 'border-[1.5px] border-zinc-300 dark:border-zinc-600',
  future: 'border-[1.5px] border-dashed border-zinc-200 dark:border-zinc-700',
};
const CELL = 'flex h-3 w-3 items-center justify-center sm:h-3.5 sm:w-3.5';

export function WeeksTable() {
  const { data, error } = useProgressActivity();
  const weeks = useMemo(() => (data ? lastWeeks(data) : null), [data]);

  if (error) return null; // Özet kartı zaten aynı hatayı gösteriyor.
  if (!weeks) return <div aria-busy="true" aria-label="Haftalar yükleniyor" className="h-72 animate-pulse rounded-3xl bg-surface-elevated" />;

  return (
    <section aria-labelledby="son-4-hafta" className="flex flex-col gap-4 rounded-3xl border border-default bg-background p-4 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 id="son-4-hafta" className="text-lg font-extrabold text-default sm:text-xl">
          Son 4 hafta
        </h2>
        <p className="text-sm text-muted-foreground">Dolu nokta: o gün soru çözdün.</p>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground sm:text-xs">
            <th scope="col" className="pb-2.5 font-extrabold">Hafta</th>
            <th scope="col" className="pb-2.5 font-extrabold">
              <span className="sr-only">Günler</span>
              <span aria-hidden="true" className="flex gap-1 sm:gap-2">
                {DAY_INITIALS.map((d, i) => (
                  <span key={i} className={CELL}>{d}</span>
                ))}
              </span>
            </th>
            <th scope="col" className="pb-2.5 text-right font-extrabold">Soru</th>
            <th scope="col" className="pb-2.5 text-right font-extrabold">Doğru</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start} className="border-t border-default">
              <th scope="row" className="whitespace-nowrap py-3.5 pr-3 text-left font-bold text-default">{w.label}</th>
              <td className="py-3.5 pr-3">
                <span className="flex gap-1 sm:gap-2">
                  {w.days.map((d, i) => (
                    <span key={d.day} className={CELL}>
                      <span role="img" aria-label={`${DAY_NAMES[i]}: ${STATE_TEXT[d.state]}`} className={`block h-full w-full rounded-full ${DOT[d.state]}`} />
                    </span>
                  ))}
                </span>
              </td>
              <td className="py-3.5 text-right font-extrabold text-default">{w.answered}</td>
              <td className="py-3.5 pl-3 text-right font-extrabold text-default">{w.accuracy == null ? '—' : `%${w.accuracy}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
