'use client';

// Anahtar kavram worker'ı (app/api/rag/generate-topic-highlights) onay beklemeden doğrudan
// yayınladığı için burada detay yok — kullanıcının 2026-09-25 isteği: "hangisini üretti
// göreyim ve ürettiği içeriğe link yeterli". Özet kısmı Model Performansı sekmesiyle ortak.
import { useEffect, useState } from 'react';
import type { RunSummary } from '@/app/src/lib/workerRunStats';
import { FailureBreakdown, RecentRunList, RunSummaryTiles, type RecentRun } from '@/app/src/components/admin/WorkerRunStats';

type Stats = { windowDays: number; last24h: RunSummary; last7d: RunSummary; pendingCount: number | null; recent: RecentRun[] };

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

          <RecentRunList runs={stats.recent} emptyText={`Son ${stats.windowDays} günde çalışma kaydı yok`} />
        </section>
      )}
    </div>
  );
}
