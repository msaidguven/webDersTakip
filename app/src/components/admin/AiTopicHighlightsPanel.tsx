'use client';

// Anahtar kavram worker'ı (app/api/rag/generate-topic-highlights) onay beklemeden doğrudan
// yayınladığı için burada taslak listesi yok — sadece izleme: son 20 çalıştırma, ürettiği
// konu ve o konuda şu an yayında olan anahtar kavramlar (kullanıcının 2026-09-25 isteği:
// "en son ne yaptığını göremiyorum").
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

type Highlight = { icon: string | null; title: string; description: string };

type WorkerRun = {
  id: number;
  generated: boolean;
  reason: string | null;
  topic_id: number | null;
  created_at: string;
  topic_title: string | null;
  unit_title: string | null;
  lesson_name: string | null;
  grade_name: string | null;
  highlights: Highlight[];
};

export default function AiTopicHighlightsPanel() {
  const [runs, setRuns] = useState<WorkerRun[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        setRuns((data?.runs as WorkerRun[] | null) || []);
        setPendingCount((data?.pendingCount as number | null) ?? null);
      } catch {
        if (!cancelled) setError('Ağ hatası oluştu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const generatedCount = runs.filter((r) => r.generated).length;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border p-4 space-y-1">
        <p className="text-sm text-foreground">
          Worker her saat <strong>:51</strong>&apos;de çalışır; yayında olup anahtar kavramı eksik olan bir sonraki konuyu
          üretip doğrudan yayınlar.
        </p>
        <p className="text-xs text-muted-foreground">
          Son {runs.length} çalıştırmanın {generatedCount} tanesi kavram üretti
          {pendingCount !== null && ` · sırada bekleyen ${pendingCount} konu`}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : runs.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">Henüz kayıtlı bir worker çalışması yok</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {runs.map((run) => {
            const isOpen = expandedId === run.id;
            return (
              <div key={run.id} className="bg-card rounded-2xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === run.id ? null : run.id))}
                  disabled={!run.generated}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-surface disabled:hover:bg-transparent"
                >
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleString('tr-TR')}
                    </span>
                    {run.generated ? (
                      <>
                        {run.grade_name && (
                          <span className="mb-1 inline-block text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                            {run.grade_name} · {run.lesson_name} · {run.unit_title}
                          </span>
                        )}
                        <p className="truncate text-sm font-bold text-foreground">
                          {run.topic_title || `Konu #${run.topic_id}`}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-300">{run.reason || 'Üretilmedi'}</p>
                    )}
                  </div>
                  {run.generated && (
                    <>
                      <span className="shrink-0 text-xs font-black text-muted-foreground">
                        {run.highlights.length} kavram
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>

                {isOpen && run.generated && (
                  <div className="border-t border-border p-4 space-y-2">
                    {run.highlights.length === 0 ? (
                      <p className="text-xs text-amber-300">
                        Bu konuda şu an yayında anahtar kavram yok — sonradan silinmiş olabilir.
                      </p>
                    ) : (
                      run.highlights.map((h, idx) => (
                        <div key={idx} className="rounded-xl border border-border p-3">
                          <p className="text-xs font-bold text-foreground">
                            {h.icon ? `${h.icon} ` : ''}{h.title}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{h.description}</p>
                        </div>
                      ))
                    )}
                    {run.topic_id && (
                      <Link
                        href={`/admin/konu-icerik/${run.topic_id}`}
                        className="inline-block text-xs font-medium text-indigo-300 hover:underline"
                      >
                        Konu içeriğini aç →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
