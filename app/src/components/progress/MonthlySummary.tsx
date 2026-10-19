'use client';

// Seçilen ayın özeti: toplam, doğru, yanlış, başarı oranı, aktif gün. Tablonun üstünde durur.
import type { MonthSummary } from '@/app/src/lib/monthlyActivity';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-indigo-100 bg-background p-3 dark:border-indigo-500/20 sm:p-4">
      <span className="truncate text-xs font-bold text-muted-foreground sm:text-[13px]">{label}</span>
      <span className="whitespace-nowrap text-xl font-black text-default sm:text-3xl">{value}</span>
    </div>
  );
}

export function MonthlySummary({ summary }: { summary: MonthSummary }) {
  return (
    <section aria-label="Ay özeti" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Tile label="Toplam soru" value={String(summary.answered)} />
      <Tile label="Doğru" value={String(summary.correct)} />
      <Tile label="Yanlış" value={String(summary.wrong)} />
      <Tile label="Başarı oranı" value={summary.accuracy == null ? '—' : `%${summary.accuracy}`} />
      <Tile label="Aktif gün" value={String(summary.activeDays)} />
    </section>
  );
}
