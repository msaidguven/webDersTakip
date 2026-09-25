'use client';

// Anahtar kavram worker'ı (app/api/rag/generate-topic-highlights) onay beklemeden doğrudan
// yayınladığı için burada detay yok — kullanıcının 2026-09-25 isteği: "hangisini üretti
// göreyim ve ürettiği içeriğe link yeterli". Özet kısmı Model Performansı sekmesiyle ortak.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { FailureKind, RunSummary } from '@/app/src/lib/workerRunStats';
import { FAILURE_LABELS, FailureBreakdown, RunSummaryTiles, formatRunTime } from '@/app/src/components/admin/WorkerRunStats';

type Run = {
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

type Stats = { windowDays: number; last24h: RunSummary; last7d: RunSummary; pendingCount: number | null; recent: Run[] };

export default function AiTopicHighlightsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/ai-topic-highlights/worker-runs');
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || 'Çalışma kayıtları alınamadı');
          return;
        }
        setStats(data as Stats);
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
      <div className="bg-card rounded-2xl border border-border p-4 space-y-1">
        <p className="text-sm text-foreground">
          Worker her saat <strong>:51</strong>&apos;de çalışır; yayında olup anahtar kavramı eksik olan bir sonraki konuyu
          üretip doğrudan yayınlar.
        </p>
        {stats?.pendingCount != null && (
          <p className="text-xs text-muted-foreground">Sırada bekleyen {stats.pendingCount} konu</p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : stats && (
        <section className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <RunSummaryTiles last24h={stats.last24h} last7d={stats.last7d} windowDays={stats.windowDays} />
          <FailureBreakdown summary={stats.last7d} windowDays={stats.windowDays} />

          <div>
            <h3 className="mb-1.5 text-xs font-bold text-muted-foreground">Son çalışmalar</h3>
            {stats.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Son {stats.windowDays} günde çalışma kaydı yok</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {stats.recent.map((run) => (
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
                            <span className="truncate">{run.topic_title || `Konu #${run.topic_id}`}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="sr-only">(yeni sekmede açılır)</span>
                          </Link>
                        ) : (
                          <span className="block truncate font-bold text-emerald-300">
                            {run.topic_title || `Konu #${run.topic_id}`}
                          </span>
                        )}
                        {run.context && <span className="block truncate text-muted-foreground">{run.context}</span>}
                      </div>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-right text-amber-300">
                        {FAILURE_LABELS[run.failureKind ?? 'other']}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
