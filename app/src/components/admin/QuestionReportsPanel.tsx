'use client';

// Öğrenci "Hatalı soru" bildirimleri + otomatik soru partilerinin durumu (2026-10-12).
// Veri: app/api/admin/question-reports/route.ts.
import { useCallback, useEffect, useState } from 'react';
import { QuestionEditModal } from '@/app/src/components/admin/ManagementTab';

type Item = {
  questionId: number;
  questionText: string;
  solutionText: string | null;
  correctAnswer: string | null;
  isActive: boolean;
  autoHidden: boolean;
  aiModel: string | null;
  context: string;
  reportCount: number;
  reports: { reason: string; note: string | null; createdAt: string }[];
};
type Batch = { topicId: number; roundNo: number; topicTitle: string; status: string; startedAt: string; publishedAt: string | null; questionCount: number | null; svgPendingCount: number | null; lastError: string | null };

const REASON_LABEL: Record<string, string> = { wrong_answer: 'Cevap yanlış', unclear: 'Anlaşılmıyor', typo: 'Yazım hatası', other: 'Diğer' };
const BATCH_LABEL: Record<string, string> = { collecting: 'Üretiliyor', publishing: 'Yayınlanıyor', published: 'Yayında', failed: 'Başarısız' };

export default function QuestionReportsPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/question-reports');
    if (!res.ok) {
      setError('Bildirimler yüklenemedi');
      return;
    }
    const data = (await res.json()) as { items: Item[]; batches: Batch[] };
    setItems(data.items);
    setBatches(data.batches);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk yükleme
    void load();
  }, [load]);

  const act = async (questionId: number, action: 'hide' | 'fixed' | 'dismiss') => {
    setBusy(questionId);
    setError('');
    const res = await fetch('/api/admin/question-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, action }) });
    setBusy(null);
    if (!res.ok) {
      setError('İşlem başarısız');
      return;
    }
    setItems((cur) => (cur ? cur.filter((i) => i.questionId !== questionId) : cur));
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Açık bildirimler</h2>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {!items ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Açık bildirim yok.</p>
        ) : (
          items.map((it) => (
            <article key={it.questionId} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{it.context}</span>
                <span>· #{it.questionId}</span>
                {it.aiModel && <span>· {it.aiModel}</span>}
                <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">{it.reportCount} bildirim</span>
                {it.autoHidden && <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">Otomatik gizlendi</span>}
                {!it.isActive && !it.autoHidden && <span className="rounded bg-muted px-2 py-0.5 font-bold">Yayında değil</span>}
              </div>
              <p className="text-sm font-semibold text-foreground">{it.questionText}</p>
              {it.correctAnswer && (
                <p className="text-sm">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">İşaretli doğru cevap:</span> {it.correctAnswer}
                </p>
              )}
              {it.solutionText && <p className="text-xs text-muted-foreground">Çözüm: {it.solutionText}</p>}
              <ul className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
                {it.reports.map((r, i) => (
                  <li key={i}>
                    <b>{REASON_LABEL[r.reason] ?? r.reason}</b>
                    {r.note && <span className="text-muted-foreground"> — {r.note}</span>}
                    <span className="text-muted-foreground"> · {new Date(r.createdAt).toLocaleString('tr-TR')}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setEditId(it.questionId)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
                  Soruyu düzenle
                </button>
                <button disabled={busy === it.questionId} onClick={() => act(it.questionId, 'fixed')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  Düzelttim, kapat
                </button>
                <button disabled={busy === it.questionId} onClick={() => act(it.questionId, 'dismiss')} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
                  Soru doğru, kapat
                </button>
                <button disabled={busy === it.questionId} onClick={() => act(it.questionId, 'hide')} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                  Yayından kaldır
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section id="partiler" className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Otomatik soru üretimi (son 30 konu)</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz konu partisi yok.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
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
                    <td className="px-3 py-2">{BATCH_LABEL[b.status] ?? b.status}</td>
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

      {editId !== null && (
        <QuestionEditModal
          questionId={editId}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null);
            void load();
          }}
          showNotice={(kind, text) => (kind === 'error' ? setError(text) : setError(''))}
        />
      )}
    </div>
  );
}
