'use client';

// Ders raporu: üniteler ve konular (2026-10-18). Ünite açmak gerekmez. Her ünite tek çerçeveli bir kutu;
// içinde her konu tek satır: solda konu adı, sağda çubuk ve tek satır sayı. Sorusu olmayan konu "Yakında"
// yazar ve tıklanamaz değildir (konu anlatımına gider). Renk tek başına anlam taşımaz: sayılar yazıyla verir.
import Link from 'next/link';
import { accuracyTone, totalsOf, type Totals, type UnitReport } from '@/app/src/lib/lessonReports';
import { mergeWeekSpans, weekLabel, type WeekRange } from '@/app/src/lib/kazanimPlan';
import type { TopicMastery } from '@/app/src/lib/topicMastery';

// Öğretim haftası etiketi (kaynak: outcome_weeks). Hafta yoksa hiçbir şey çizilmez.
function WeekTag({ range }: { range: WeekRange | null | undefined }) {
  if (!range) return null;
  return <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{weekLabel(range)}</span>;
}

const PILL = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  mid: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  bad: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  none: 'bg-surface-elevated text-muted-foreground',
} as const;

export function Legend() {
  const items = [
    ['bg-emerald-500', 'Doğru'],
    ['bg-rose-500', 'Yanlış'],
    ['bg-slate-200 dark:bg-slate-700', 'Çözülmedi'],
  ] as const;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
      {items.map(([cls, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${cls}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

export function Pill({ totals }: { totals: Totals }) {
  const { solved, accuracy, total } = totals;
  if (total === 0) return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black ${PILL.none}`}>yakında</span>;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums ${PILL[accuracyTone(accuracy)]}`}>
      {solved === 0 ? 'başlanmadı' : accuracy == null ? 'veri az' : `%${accuracy} başarı`}
    </span>
  );
}

// Parçalı çubuk. Sorusu yoksa boş gri çubuk (satırlar aynı hizada kalsın).
function Bar({ totals }: { totals: Totals }) {
  const { total, solved, correct } = totals;
  const wrong = solved - correct;
  return (
    <span
      className="flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="img"
      aria-label={total === 0 ? 'Henüz soru yok' : `${total} sorunun ${correct} doğru, ${wrong} yanlış, ${total - solved} çözülmedi`}
    >
      {total > 0 && (
        <>
          <span className="h-full bg-emerald-500" style={{ width: `${(correct / total) * 100}%` }} />
          <span className="h-full bg-rose-500" style={{ width: `${(wrong / total) * 100}%` }} />
        </>
      )}
    </span>
  );
}

function TopicRow({ t, week }: { t: TopicMastery; week: WeekRange | null | undefined }) {
  const totals = totalsOf([t]);
  const { total, solved, correct } = totals;
  const body = (
    <>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold leading-snug text-default sm:w-1/2">
        {t.title}
        <WeekTag range={week} />
      </span>
      <span className="flex min-w-0 flex-col gap-1.5 sm:w-1/2">
        <Bar totals={totals} />
        <span className="text-xs tabular-nums text-muted-foreground">
          {total === 0 ? 'Yakında' : `${solved}/${total} çözüldü · ${correct} doğru · ${solved - correct} yanlış`}
        </span>
      </span>
    </>
  );
  const cls = 'flex flex-col gap-2 rounded-xl border border-default bg-background p-3.5 sm:flex-row sm:items-center sm:gap-6';
  if (!t.href) return <li className={cls}>{body}</li>;
  return (
    <li>
      <Link href={t.href} className={`${cls} transition-colors hover:border-indigo-300 dark:hover:border-indigo-400/50`}>
        {body}
      </Link>
    </li>
  );
}

// weekSpans: konu kimliği → hafta aralığı (useTopicWeekSpans). Ünite aralığı konularından türetilir.
export function UnitProgressChart({ units, weekSpans }: { units: UnitReport[]; weekSpans?: Record<number, WeekRange | null> }) {
  return (
    <div className="flex flex-col gap-5">
      <Legend />
      {units.map((u) => (
        <section key={u.key} aria-label={u.title} className="flex flex-col gap-3 rounded-2xl border border-default p-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 text-base font-extrabold leading-snug text-default">{u.title}</h3>
              <WeekTag range={mergeWeekSpans(u.topics.map((t) => weekSpans?.[t.id]))} />
            </div>
            <Pill totals={u.totals} />
          </header>
          <ul className="flex flex-col gap-2">
            {u.topics.map((t) => (
              <TopicRow key={t.id} t={t} week={weekSpans?.[t.id]} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
