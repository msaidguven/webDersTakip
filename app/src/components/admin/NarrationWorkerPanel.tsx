'use client';

// "Video / Sesli Anlatım" worker'ının son çalıştırmaları (saatlik pg_cron, :45). Worker her
// çağrıda sıradaki konuyu Azure TTS ile seslendirir; sonuç topic_narration_worker_runs'a yazılır
// (bkz. app/api/narration/worker, supabase/migrations/topic_narrations.sql).
import { useEffect, useState } from 'react';

type Outcome = 'completed' | 'partial' | 'failed' | 'idle';

type Run = {
  id: number;
  topic_id: number | null;
  outcome: Outcome;
  screens_made: number;
  screens_reused: number;
  reason: string | null;
  created_at: string;
  topics: { title: string; units: { title: string; grades: { name: string } | null; lessons: { name: string } | null } | null } | null;
};

type Data = { runs: Run[]; readyTopics: number; totalMinutes: number };

const OUTCOME: Record<Outcome, { label: string; className: string }> = {
  completed: { label: 'Tamamlandı', className: 'bg-emerald-500/15 text-emerald-300' },
  partial: { label: 'Yarıda kaldı, devam edecek', className: 'bg-sky-500/15 text-sky-300' },
  failed: { label: 'Hata', className: 'bg-red-500/15 text-red-300' },
  idle: { label: 'Bekleyen konu yok', className: 'bg-muted text-muted-foreground' },
};

export default function NarrationWorkerPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/narration/worker-runs')
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        setData(json as Data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="text-sm text-red-300">Çalışma raporu yüklenemedi: {error}</p>;
  if (!data) return <p className="text-muted-foreground text-sm">Yükleniyor…</p>;

  const completed = data.runs.filter((r) => r.outcome === 'completed').length;
  const failed = data.runs.filter((r) => r.outcome === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Anlatımı hazır konu" value={data.readyTopics} />
        <Stat label="Toplam anlatım" value={`${data.totalMinutes} dk`} />
        <Stat label={`Son ${data.runs.length} çalıştırma`} value={`${completed} tamam · ${failed} hata`} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <p className="border-b border-border px-4 py-3 text-xs font-bold text-muted-foreground">
          Son Çalışmalar · worker saatte bir (:45) sıradaki konuyu seslendirir
        </p>
        {data.runs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">Henüz çalıştırma yok.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.runs.map((run) => {
              const o = OUTCOME[run.outcome];
              const unit = run.topics?.units;
              return (
                <div key={run.id} className="grid gap-1 px-4 py-2.5 text-xs sm:grid-cols-[9.5rem_1fr_auto] sm:items-center sm:gap-3">
                  <span className="text-muted-foreground tabular-nums">{new Date(run.created_at).toLocaleString('tr-TR')}</span>
                  <div className="min-w-0">
                    {run.topics ? (
                      <a href={`/admin/konu-icerik/${run.topic_id}`} className="block truncate font-semibold text-foreground hover:underline">
                        {run.topics.title}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {unit && (
                      <p className="truncate text-muted-foreground">{[unit.grades?.name, unit.lessons?.name, unit.title].filter(Boolean).join(' · ')}</p>
                    )}
                    {run.reason && <p className={`truncate ${run.outcome === 'failed' ? 'text-red-300' : 'text-muted-foreground'}`} title={run.reason}>{run.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    {(run.screens_made > 0 || run.screens_reused > 0) && (
                      <span className="text-muted-foreground tabular-nums">{run.screens_made} yeni · {run.screens_reused} önbellek</span>
                    )}
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${o.className}`}>{o.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, className = '' }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
