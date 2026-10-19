'use client';

// Aylık çizelge tablosu: gün × ders, doğru/yanlış, günlük toplam. Kağıt "soru çözüm çizelgesi"nin
// karşılığı; net hesabı yok (kullanıcı kararı). Geniş tablo kendi kapsayıcısında kayar, sayfa kaymaz.
import { useMemo } from 'react';
import { buildMonthDays, type MonthlyActivityRow } from '@/app/src/lib/monthlyActivity';

interface Lesson {
  id: number;
  name: string;
}

const EMPTY = '–';

function Count({ value, tone }: { value: number; tone?: 'good' | 'bad' }) {
  if (value === 0) return <span className="text-muted-foreground">{EMPTY}</span>;
  const color = tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : 'text-default';
  return <span className={`font-bold ${color}`}>{value}</span>;
}

export function MonthlyTable({ month, lessons, rows }: { month: string; lessons: Lesson[]; rows: MonthlyActivityRow[] }) {
  const days = useMemo(() => buildMonthDays(rows, month), [rows, month]);

  const monthTotals = useMemo(() => {
    const subjects: Record<number, { correct: number; wrong: number }> = {};
    for (const l of lessons) subjects[l.id] = { correct: 0, wrong: 0 };
    let total = 0;
    for (const d of days) {
      total += d.total;
      for (const [id, c] of Object.entries(d.subjects)) {
        const s = subjects[Number(id)];
        if (!s) continue;
        s.correct += c.correct;
        s.wrong += c.wrong;
      }
    }
    return { subjects, total };
  }, [days, lessons]);

  const cellClass = 'border border-default px-2 py-1.5 text-center tabular-nums';

  return (
    <div className="overflow-x-auto rounded-2xl border border-default bg-background">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">{month} ayı günlük soru çözüm tablosu</caption>
        <thead className="bg-surface text-default">
          <tr>
            <th scope="col" rowSpan={2} className={`${cellClass} font-extrabold`}>
              Tarih
            </th>
            {lessons.map((l) => (
              <th key={l.id} scope="colgroup" colSpan={2} className={`${cellClass} font-extrabold`}>
                {l.name}
              </th>
            ))}
            <th scope="col" rowSpan={2} className={`${cellClass} font-extrabold`}>
              Toplam
            </th>
          </tr>
          <tr>
            {lessons.map((l) => (
              <LessonSubHeaders key={l.id} lessonName={l.name} />
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row" className={`${cellClass} font-bold text-muted-foreground`}>
                {Number(d.day.slice(8, 10))}
              </th>
              {lessons.map((l) => {
                const c = d.subjects[l.id];
                return (
                  <CountPair key={l.id} correct={c?.correct ?? 0} wrong={c?.wrong ?? 0} className={cellClass} />
                );
              })}
              <td className={cellClass}>
                <Count value={d.total} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-surface font-extrabold text-default">
          <tr>
            <th scope="row" className={cellClass}>
              Ay toplamı
            </th>
            {lessons.map((l) => {
              const t = monthTotals.subjects[l.id];
              return (
                <CountPair key={l.id} correct={t.correct} wrong={t.wrong} className={cellClass} />
              );
            })}
            <td className={cellClass}>{monthTotals.total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function LessonSubHeaders({ lessonName }: { lessonName: string }) {
  return (
    <>
      <th scope="col" className="border border-default px-2 py-1 text-xs font-bold text-muted-foreground">
        <span className="sr-only">{lessonName} </span>Doğru
      </th>
      <th scope="col" className="border border-default px-2 py-1 text-xs font-bold text-muted-foreground">
        <span className="sr-only">{lessonName} </span>Yanlış
      </th>
    </>
  );
}

function CountPair({ correct, wrong, className }: { correct: number; wrong: number; className: string }) {
  return (
    <>
      <td className={className}>
        <Count value={correct} tone="good" />
      </td>
      <td className={className}>
        <Count value={wrong} tone="bad" />
      </td>
    </>
  );
}
