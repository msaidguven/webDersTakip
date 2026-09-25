// AI worker sekmelerinin (Model Performansı, AI Anahtar Kavramlar) ortak özet parçaları —
// sınıflandırma mantığı app/src/lib/workerRunStats.ts'te.
import type { FailureKind, RunSummary } from '@/app/src/lib/workerRunStats';

export const FAILURE_LABELS: Record<FailureKind, string> = {
  overloaded: 'Model yoğun (503)',
  quota: 'Kota doldu (429)',
  no_topic: 'Sırada konu yok',
  race: 'Diğer worker önce üretti',
  other: 'Diğer hata',
};

export function formatRunTime(iso: string): string {
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
