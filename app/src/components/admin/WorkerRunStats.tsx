// AI worker sekmelerinin (Model Performansı, AI Anahtar Kavramlar) ortak özet parçaları —
// sınıflandırma mantığı app/src/lib/workerRunStats.ts'te.
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { FailureKind, RunSummary } from '@/app/src/lib/workerRunStats';

export const FAILURE_LABELS: Record<FailureKind, string> = {
  overloaded: 'Model yoğun (503)',
  quota: 'Kota doldu (429)',
  no_topic: 'Sırada konu yok',
  race: 'Diğer worker önce üretti',
  other: 'Diğer hata',
};

function formatRunTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function successRate(s: RunSummary): string {
  return s.total ? `%${Math.round((s.generated / s.total) * 100)}` : '—';
}

export function RunSummaryTiles({ last24h, last7d, windowDays }: { last24h: RunSummary; last7d: RunSummary; windowDays: number }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      {[
        { label: 'Son 24 saat', s: last24h },
        { label: `Son ${windowDays} gün`, s: last7d },
      ].map(({ label, s }) => (
        <div key={label} className="rounded-xl border border-border p-3">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-2xl font-black text-foreground tabular-nums">{successRate(s)}</dd>
          <dd className="text-xs text-muted-foreground tabular-nums">
            {s.generated} başarılı / {s.total} çalışma
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function FailureBreakdown({ summary, windowDays }: { summary: RunSummary; windowDays: number }) {
  const entries = (Object.entries(summary.failures) as [FailureKind, number][]).filter(([, n]) => n > 0);
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold text-muted-foreground">Başarısızlık nedenleri ({windowDays} gün)</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Başarısız çalışma yok</p>
      ) : (
        <ul className="space-y-1">
          {entries.map(([kind, n]) => (
            <li key={kind} className="flex justify-between text-xs">
              <span className="text-amber-300">{FAILURE_LABELS[kind]}</span>
              <span className="tabular-nums text-foreground">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type RecentRun = {
  id: number;
  generated: boolean;
  reason: string | null;
  failureKind: FailureKind | null;
  created_at: string;
  topic_id: number | null;
  topic_title: string | null;
  context: string | null;
  href: string | null;
};

// Başarılı satırda üretilen konu + public sayfasına yeni sekmede link, başarısızda neden.
export function RecentRunList({ runs, emptyText }: { runs: RecentRun[]; emptyText: string }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-bold text-muted-foreground">Son çalışmalar</h3>
      {runs.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {runs.map((run) => {
            const title = run.topic_title || (run.topic_id ? `Konu #${run.topic_id}` : 'Üretildi');
            return (
              <li key={run.id} className="flex items-center gap-3 px-3 py-2.5 text-xs" title={run.reason ?? undefined}>
                <span className="shrink-0 text-muted-foreground tabular-nums">{formatRunTime(run.created_at)}</span>
                {run.generated ? (
                  <div className="min-w-0 flex-1">
                    {run.href ? (
                      <Link
                        href={run.href}
                        target="_blank"
                        className="inline-flex max-w-full items-center gap-1 font-bold text-emerald-300 hover:underline"
                      >
                        <span className="truncate">{title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="sr-only">(yeni sekmede açılır)</span>
                      </Link>
                    ) : (
                      <span className="block truncate font-bold text-emerald-300">{title}</span>
                    )}
                    {run.context && <span className="block truncate text-muted-foreground">{run.context}</span>}
                  </div>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-right text-amber-300">
                    {FAILURE_LABELS[run.failureKind ?? 'other']}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
