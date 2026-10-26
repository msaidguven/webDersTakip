'use client';

// Otomatik soru üretiminin son 30 konu partisi (2026-10-26'da soru bildirimleri sayfasından ayrıldı).
// Veri: app/api/admin/topic-batches/route.ts; "İnceleme bekliyor" partisi buradan yayınlanır (./publish).
import { useCallback, useEffect, useState } from 'react';

type Batch = { topicId: number; roundNo: number; topicTitle: string; status: string; startedAt: string; publishedAt: string | null; questionCount: number | null; svgPendingCount: number | null; lastError: string | null };

const BATCH_LABEL: Record<string, string> = { collecting: 'Üretiliyor', publishing: 'Yayınlanıyor', awaiting_review: 'İnceleme bekliyor', published: 'Yayında', failed: 'Başarısız' };

export default function TopicBatchesPanel() {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/topic-batches');
    if (!res.ok) {
      setError('Konu partileri yüklenemedi');
      return;
    }
    setBatches(((await res.json()) as { batches: Batch[] }).batches);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk yükleme
    void load();
  }, [load]);

  const publishBatch = async (b: Batch) => {
    setError('');
    const res = await fetch('/api/admin/topic-batches/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicId: b.topicId, roundNo: b.roundNo }) });
    const data = (await res.json().catch(() => null)) as { reason?: string; error?: string } | null;
    if (!res.ok) setError(data?.error ?? data?.reason ?? 'Yayınlanamadı');
    void load();
  };

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-3 text-foreground">
      <h2 className="text-lg font-bold">Otomatik soru üretimi (son 30 konu)</h2>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!batches ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
      ) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz konu partisi yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Konu</th>
                <th className="px-3 py-2">Tur</th>
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">Soru</th>
                <th className="px-3 py-2">Çizim bekleyen</th>
                <th className="px-3 py-2">Başlangıç</th>
                <th className="px-3 py-2">Hata</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={`${b.topicId}-${b.roundNo}`} className="border-t border-border">
                  <td className="px-3 py-2 font-semibold">{b.topicTitle}</td>
                  <td className="px-3 py-2">{b.roundNo}</td>
                  <td className="px-3 py-2">
                    {BATCH_LABEL[b.status] ?? b.status}
                    {b.status === 'awaiting_review' && (
                      <button onClick={() => publishBatch(b)} className="ml-2 rounded bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white">
                        Yayınla
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">{b.questionCount ?? '—'}</td>
                  <td className="px-3 py-2">{b.svgPendingCount ?? '—'}</td>
                  <td className="px-3 py-2">{new Date(b.startedAt).toLocaleString('tr-TR')}</td>
                  <td className="px-3 py-2 text-rose-600">{b.lastError ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
