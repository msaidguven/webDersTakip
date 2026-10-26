'use client';

// Öğrenci "Hatalı soru" bildirimleri + otomatik soru partilerinin durumu (2026-10-12).
// Veri: app/api/admin/question-reports/route.ts. 2026-10-25: her bildirimin öğrenciyle yazışması var — yazışma ve
// cevap kutusu (./reply), öğrenci /profil/bildirdigim-sorular'da okuyup geri yazar.
import { useCallback, useEffect, useState } from 'react';
import { QuestionEditModal } from '@/app/src/components/admin/ManagementTab';

type Message = { sender: 'admin' | 'student'; body: string; createdAt: string };
type Report = { id: number; reason: string; note: string | null; createdAt: string; isOpen: boolean; studentName: string; chosenAnswer: string | null; messages: Message[] };
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
  hasOpen: boolean;
  reports: Report[];
};
type Batch = { topicId: number; roundNo: number; topicTitle: string; status: string; startedAt: string; publishedAt: string | null; questionCount: number | null; svgPendingCount: number | null; lastError: string | null };

const REASON_LABEL: Record<string, string> = { wrong_answer: 'Cevap yanlış', unclear: 'Anlaşılmıyor', typo: 'Yazım hatası', other: 'Diğer' };
// Cevap kutusunun hazır taslağı — admin gönderip göndermeden önce düzenler.
function replyDraft(it: Item, r: Report) {
  const firstName = r.studentName.split(/\s+/)[0];
  return [
    `Merhaba ${firstName}, geri bildirimin için çok teşekkür ederim!`,
    `Soruyu kontrol ettim. Doğru cevap: ${it.correctAnswer ?? '…'}${r.chosenAnswer ? ` (sen "${r.chosenAnswer}" işaretlemiştin)` : ''}.`,
    it.solutionText ?? '',
    'Başka bir hata görürsen yine bildir, çok işimize yarıyor.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function ReportThread({ it, report, onSent }: { it: Item; report: Report; onSent: (m: Message) => void }) {
  const [skipped, setSkipped] = useState(false);
  const studentLast = !skipped && report.messages.at(-1)?.sender === 'student';
  const awaitingAdmin = report.messages.length === 0 || studentLast;
  const [text, setText] = useState(() => (report.messages.length === 0 ? replyDraft(it, report) : ''));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setSending(true);
    setError('');
    const res = await fetch('/api/admin/question-reports/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: report.id, body: text }) });
    setSending(false);
    if (!res.ok) {
      setError('Gönderilemedi');
      return;
    }
    onSent({ sender: 'admin', body: text.trim(), createdAt: new Date().toISOString() });
    setText('');
  };

  const skip = async () => {
    setSending(true);
    setError('');
    const res = await fetch('/api/admin/question-reports/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: report.id, skip: true }) });
    setSending(false);
    if (res.ok) setSkipped(true);
    else setError('İşlem başarısız');
  };

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-2 text-xs">
        <b>{report.studentName}</b>
        <span>· {REASON_LABEL[report.reason] ?? report.reason}</span>
        {report.chosenAnswer && <span className="text-muted-foreground">· işaretlediği: {report.chosenAnswer}</span>}
        <span className="text-muted-foreground">· {new Date(report.createdAt).toLocaleString('tr-TR')}</span>
        {!report.isOpen && <span className="rounded bg-muted px-2 py-0.5 font-bold">Kapalı</span>}
        {awaitingAdmin && <span className="rounded bg-amber-100 px-2 py-0.5 font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">Cevap bekliyor</span>}
      </div>
      {report.note && <p className="text-xs text-muted-foreground">Not: {report.note}</p>}
      {report.messages.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {report.messages.map((m, i) => (
            <li
              key={i}
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${m.sender === 'admin' ? 'self-end bg-indigo-50 text-indigo-950 dark:bg-indigo-500/15 dark:text-indigo-100' : 'self-start bg-muted text-foreground'}`}
            >
              {m.body}
              <span className="mt-1 block text-[10px] opacity-60">{m.sender === 'admin' ? 'Sen' : report.studentName} · {new Date(m.createdAt).toLocaleString('tr-TR')}</span>
            </li>
          ))}
        </ol>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {report.messages.length === 0 ? 'Cevabın (taslak hazır, düzenleyebilirsin)' : 'Cevap yaz'}
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 2000))} rows={report.messages.length === 0 ? 6 : 3} maxLength={2000} className="rounded-lg border border-border bg-background p-2 text-sm text-foreground" />
      </label>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={sending || !text.trim()} onClick={send} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {sending ? 'Gönderiliyor…' : 'Öğrenciye gönder'}
        </button>
        {studentLast && (
          <button disabled={sending} onClick={skip} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
            Cevap gerekmiyor
          </button>
        )}
      </div>
    </li>
  );
}

const BATCH_LABEL: Record<string, string> = { collecting: 'Üretiliyor', publishing: 'Yayınlanıyor', awaiting_review: 'İnceleme bekliyor', published: 'Yayında', failed: 'Başarısız' };

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

  const publishBatch = async (b: Batch) => {
    setError('');
    const res = await fetch('/api/admin/topic-batches/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicId: b.topicId, roundNo: b.roundNo }) });
    const data = (await res.json().catch(() => null)) as { reason?: string; error?: string } | null;
    if (!res.ok) setError(data?.error ?? data?.reason ?? 'Yayınlanamadı');
    void load();
  };

  const act = async (questionId: number, action: 'hide' | 'fixed' | 'dismiss') => {
    setBusy(questionId);
    setError('');
    const res = await fetch('/api/admin/question-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId, action }) });
    setBusy(null);
    if (!res.ok) {
      setError('İşlem başarısız');
      return;
    }
    // Kapanan bildirim öğrenciye geçer (Tamamlanan); kapalı bildirime yazılamadığı için listeden düşer.
    setItems((cur) => (cur ? cur.filter((i) => i.questionId !== questionId) : cur));
  };

  const appendMessage = (questionId: number, reportId: number, m: Message) =>
    setItems((cur) =>
      cur?.map((i) => (i.questionId !== questionId ? i : { ...i, reports: i.reports.map((r) => (r.id === reportId ? { ...r, messages: [...r.messages, m] } : r)) })) ?? cur
    );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Açık bildirimler ve yazışmalar</h2>
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
              <ul className="flex flex-col gap-2 border-t border-border pt-3">
                {it.reports.map((r) => (
                  <ReportThread key={r.id} it={it} report={r} onSent={(m) => appendMessage(it.questionId, r.id, m)} />
                ))}
              </ul>
              {it.hasOpen && (
              <>
              <p className="text-[11px] text-muted-foreground">Kapatınca bildiren öğrenciye sonuç bildirimi gider ve bildirim onun &quot;Tamamlanan&quot; sekmesine geçer; kapalı bildirime öğrenci yazamaz.</p>
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
                  Yayından kaldır, kapat
                </button>
              </div>
              </>
              )}
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
