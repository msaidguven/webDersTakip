// Yıllık plan: ders kartı (sınıf altında) → üniteler → konular. Her seviye açılır (details); varsayılan
// kapalı, böylece sayfa tek seferde uzamaz. Metin HTML'de durur, arama motorları görür.
// Ders kimliği (renk, ikon) subjectStyle'dan gelir.
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import type { PlanItem, PlanLesson, PlanUnit } from '@/app/src/lib/yillikPlanPage';

type Current = number | null;

function weekRange(first: number, last: number): string {
  return first === last ? `${first}. hafta` : `${first}–${last}. hafta`;
}

function inWeek(item: PlanItem, current: Current): boolean {
  return current !== null && item.ranges.some((r) => current >= r.start && current <= r.end);
}

function UnitBlock({ unit, currentWeek }: { unit: PlanUnit; currentWeek: Current }) {
  const currentCount = unit.items.filter((i) => inWeek(i, currentWeek)).length;
  return (
    <details className="group rounded-xl border border-white/70 bg-background/80 dark:border-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-extrabold text-default">{unit.title}</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {unit.items.length} konu · {weekRange(unit.firstWeek, unit.lastWeek)}
            {currentCount > 0 && <span className="font-bold text-indigo-700 dark:text-indigo-300"> · Bu hafta {currentCount}</span>}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ol className="flex flex-col gap-1.5 px-3 pb-3">
        {unit.items.map((item) => {
          const isCurrent = inWeek(item, currentWeek);
          const label = item.week === item.endWeek ? `${item.week}. hafta` : `${item.week}–${item.endWeek}. hafta`;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isCurrent ? 'bg-background shadow-sm ring-1 ring-indigo-300 dark:ring-indigo-500/40' : ''}`}
              aria-current={isCurrent ? 'true' : undefined}
            >
              <span className="w-20 shrink-0 text-xs font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{label}</span>
              <Link href={item.href} className="min-w-0 flex-1 truncate text-sm font-semibold text-default hover:underline">
                {item.title}
              </Link>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

export function PlanCard({ lesson, currentWeek }: { lesson: PlanLesson; currentWeek: Current }) {
  const style = subjectStyle(lesson.name);
  const { Icon } = style;
  const currentCount = lesson.units.reduce((n, u) => n + u.items.filter((i) => inWeek(i, currentWeek)).length, 0);

  return (
    <details className={`group flex flex-col rounded-2xl border ${style.tint}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.chip}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-extrabold text-default">{lesson.name}</span>
          <span className="text-xs font-semibold text-muted-foreground">
            {lesson.topicCount} konu · {lesson.units.length} ünite · {weekRange(lesson.firstWeek, lesson.lastWeek)}
          </span>
          {currentCount > 0 && (
            <span className="mt-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">Bu hafta {currentCount} konu işleniyor</span>
          )}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="flex flex-col gap-3 px-5 pb-5 sm:px-6 sm:pb-6">
        {lesson.units.map((unit) => (
          <UnitBlock key={unit.id} unit={unit} currentWeek={currentWeek} />
        ))}
        <Link href={lesson.href} className="mt-1 self-start text-sm font-extrabold text-indigo-600 hover:underline dark:text-indigo-400">
          Derse git →
        </Link>
      </div>
    </details>
  );
}
