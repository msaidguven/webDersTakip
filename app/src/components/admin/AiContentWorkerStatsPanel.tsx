'use client';

// İçerik worker'larının (bkz. contentWorkerProfiles.ts) model bazında karşılaştırması —
// kullanıcının 2026-09-25 isteği: "ne kadar çalıştı ve ne kadarı başarılı". İki model yan
// yana duruyor ki 503 fallback kararı gibi seçimler buradan okunabilsin.
import { useEffect, useState } from 'react';
import type { FailureKind, RunSummary } from '@/app/src/lib/workerRunStats';
import { FAILURE_LABELS, FailureBreakdown, RunSummaryTiles, formatRunTime } from '@/app/src/components/admin/WorkerRunStats';

type WorkerStats = {
  id: string;
  model: string;
  cronMinute: number;
  last24h: RunSummary;
  last7d: RunSummary;
  recent: { id: number; generated: boolean; reason: string | null; failureKind: FailureKind | null; created_at: string }[];
};

export default function AiContentWorkerStatsPanel() {
  const [workers, setWorkers] = useState<WorkerStats[]>([]);
  const [windowDays, setWindowDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/ai-content-drafts/worker-stats');
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || 'İstatistikler alınamadı');
          return;
        }
        setWorkers((data?.workers as WorkerStats[] | null) || []);
        setWindowDays((data?.windowDays as number | null) ?? 7);
      } catch {
        if (!cancelled) setError('Ağ hatası oluştu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-sm text-foreground">
          İçerik taslağı üreten worker&apos;ların model bazında başarı oranı. Aynı prompt ve aynı konu sırasıyla çalışırlar;
          fark sadece model ve API key.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workers.map((w) => (
            <section key={w.id} className="bg-card rounded-2xl border border-border p-4 space-y-4" aria-label={w.model}>
              <header>
                <h2 className="text-sm font-bold text-foreground">{w.model}</h2>
                <p className="text-xs text-muted-foreground">Her saat :{String(w.cronMinute).padStart(2, '0')}&apos;de çalışır</p>
              </header>

              <RunSummaryTiles last24h={w.last24h} last7d={w.last7d} windowDays={windowDays} />
              <FailureBreakdown summary={w.last7d} windowDays={windowDays} />

              <div>
                <h3 className="mb-1.5 text-xs font-bold text-muted-foreground">Son çalışmalar</h3>
                {w.recent.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Henüz çalışma kaydı yok</p>
                ) : (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {w.recent.map((run) => (
                      <li key={run.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs" title={run.reason ?? undefined}>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {formatRunTime(run.created_at)}
                        </span>
                        <span className={`truncate text-right ${run.generated ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {run.generated ? '✓ Taslak üretildi' : FAILURE_LABELS[run.failureKind ?? 'other']}
                        </span>
                      </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
          ))}
        </div>
      )}
    </div>
  );
}
