'use client';

// Mini ders takip çizelgesi (İlerlemem, 2026-10-20 — "Bu hafta önceliğin"in yerine). Son 7 gün (kayan,
// bugün dahil) × ders: her hücrede o gün o dersten doğru / yanlış sayısı; ders ve gün toplamları.
// Veri aylık çizelgeyle aynı RPC'den (get_my_monthly_subject_activity); 7 gün iki aya yayılırsa
// önceki ay da çekilir. Tam ay tablosu /ders-takip-cizelgesi'nde.
import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useTopicMastery } from '@/app/src/hooks/useTopicMastery';
import { useMonthlyActivity } from '@/app/src/hooks/useMonthlyActivity';
import { addDays, istanbulToday } from '@/app/src/lib/progressActivity';
import r from '../robotic/robotic.module.css';

const WEEKDAY = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'UTC' });

function weekdayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return WEEKDAY.format(new Date(Date.UTC(y, m - 1, d)));
}

type Cell = { correct: number; wrong: number };

function CellCounts({ correct, wrong }: Cell) {
  if (correct === 0 && wrong === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className="font-bold text-emerald-600 dark:text-emerald-400">{correct}</span>
      <span className="font-bold text-rose-600 dark:text-rose-400">{wrong}</span>
    </span>
  );
}

export function WeeklyChart() {
  const today = istanbulToday();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)), [today]);
  const firstMonth = days[0].slice(0, 7);
  const lastMonth = today.slice(0, 7);
  const { data: mastery, error: masteryError } = useTopicMastery();
  const current = useMonthlyActivity(lastMonth);
  // Aynı anahtar → SWR tek istek; 7 gün tek aydaysa ek sorgu olmaz.
  const previous = useMonthlyActivity(firstMonth);

  const lessons = mastery?.lessons ?? [];
  const rows = useMemo(
    () => [...(current.data ?? []), ...(firstMonth !== lastMonth ? previous.data ?? [] : [])],
    [current.data, previous.data, firstMonth, lastMonth]
  );

  const grid = useMemo(() => {
    const cells = new Map<string, Cell>(); // `${lessonId}|${day}`
    for (const row of rows) {
      if (row.day < days[0] || row.day > today) continue;
      cells.set(`${row.lesson_id}|${row.day}`, { correct: row.correct, wrong: row.answered - row.correct });
    }
    return cells;
  }, [rows, days, today]);

  const get = (lessonId: number, day: string): Cell => grid.get(`${lessonId}|${day}`) ?? { correct: 0, wrong: 0 };
  const sum = (cells: Cell[]): Cell => cells.reduce((a, c) => ({ correct: a.correct + c.correct, wrong: a.wrong + c.wrong }), { correct: 0, wrong: 0 });

  const total = sum(lessons.flatMap((l) => days.map((d) => get(l.id, d))));

  const failed = masteryError || current.error || previous.error;
  const loading = mastery === undefined || current.isLoading || previous.isLoading;
  const cell = 'border px-1 py-1.5 text-center tabular-nums sm:px-1.5';
  const edge = r.divider;

  return (
    <section aria-labelledby="haftalik-cizelge" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="haftalik-cizelge" className={`text-lg font-bold tracking-tight text-default uppercase sm:text-xl ${r.display}`}>
          Son 7 gün çizelgen
        </h2>
        <span className="text-xs font-medium text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">doğru</span> /{' '}
          <span className="text-rose-600 dark:text-rose-400">yanlış</span>
        </span>
      </div>

      {failed ? (
        <p role="alert" className={`p-4 text-sm text-muted-foreground ${r.panel}`}>
          Çizelgen şu an yüklenemedi. Sayfayı yenilemeyi dene.
        </p>
      ) : loading ? (
        <div aria-busy="true" aria-label="Çizelge yükleniyor" className="h-72 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : (
        <div className={`flex flex-col gap-3 rounded-2xl p-3 sm:p-4 ${r.panel}`}>
          <p className="text-sm text-default">
            {total.correct + total.wrong === 0 ? (
              'Son 7 günde soru çözmedin.'
            ) : (
              <>
                <strong>{total.correct + total.wrong}</strong> soru ·{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{total.correct} doğru</strong> ·{' '}
                <strong className="text-rose-600 dark:text-rose-400">{total.wrong} yanlış</strong>
              </>
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px] sm:text-xs">
              <caption className="sr-only">Son 7 günde derslere göre doğru ve yanlış soru sayıları</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className={`${cell} ${edge} text-left font-semibold`}>
                    Ders
                  </th>
                  {days.map((d) => (
                    <th key={d} scope="col" className={`${cell} ${edge} font-semibold ${d === today ? r.accent : ''}`}>
                      <span className="block capitalize">{weekdayLabel(d)}</span>
                      <span className="block font-normal">{Number(d.slice(8))}</span>
                    </th>
                  ))}
                  <th scope="col" className={`${cell} ${edge} font-semibold`}>
                    Top.
                  </th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.id}>
                    <th scope="row" className={`${cell} ${edge} max-w-[5.5rem] truncate text-left sm:max-w-[7rem] font-semibold text-default`} title={l.name}>
                      {l.name}
                    </th>
                    {days.map((d) => (
                      <td key={d} className={`${cell} ${edge}`}>
                        <CellCounts {...get(l.id, d)} />
                      </td>
                    ))}
                    <td className={`${cell} ${edge}`}>
                      <CellCounts {...sum(days.map((d) => get(l.id, d)))} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className={`${cell} ${edge} text-left font-bold text-default`}>
                    Toplam
                  </th>
                  {days.map((d) => (
                    <td key={d} className={`${cell} ${edge}`}>
                      <CellCounts {...sum(lessons.map((l) => get(l.id, d)))} />
                    </td>
                  ))}
                  <td className={`${cell} ${edge}`}>
                    <CellCounts {...total} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Link href="/ders-takip-cizelgesi" className={`inline-flex w-fit items-center gap-1.5 text-sm font-semibold ${r.accent}`}>
            Aylık çizelgenin tamamı <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
