'use client';

// Admin anasayfası "Yazılı kullanımı" (2026-10-29): "Yeni yazılı aç"ı kaç kişi kullanıyor, hangi yazılılar çözülmüş,
// kaçı yapay zekâya gönderilmiş. Veri /api/admin/yazili-kullanim (admin_yazili_usage RPC'si); admin ve test hesapları sayılmaz.
import { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';

type Counts = { users: number; attempts: number; sent: number; graded: number; open: number };
type ExamRow = { exam_id: number; grade: string; lesson: string; term: number; exam_no: number; users: number; attempts: number; sent: number; graded: number; avg_pct: number | null };
type Usage = { summary: Record<'today' | 'd7' | 'd30' | 'all', Counts>; exams: ExamRow[] };

const WINDOWS = [
  { key: 'today', label: 'Bugün' },
  { key: 'd7', label: 'Son 7 gün' },
  { key: 'd30', label: 'Son 30 gün' },
  { key: 'all', label: 'Tümü' },
] as const;

export function AdminYaziliUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]['key']>('d7');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/yazili-kullanim')
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) setError(data?.error || 'Yazılı kullanımı yüklenemedi');
        else setUsage(data);
      })
      .catch(() => !cancelled && setError('Yazılı kullanımı yüklenemedi'));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = usage?.summary[windowKey];
  const stats = counts && [
    { label: 'Kişi', value: counts.users },
    { label: 'Açılan yazılı', value: counts.attempts },
    { label: 'AI\'ye gönderilen', value: counts.sent },
    { label: 'Puanlanan', value: counts.graded },
    { label: 'Yarım kalan', value: counts.open },
  ];

  return (
    <section aria-labelledby="yazili-kullanim" className={`flex flex-col gap-4 p-5 sm:p-7 ${r.panel} rounded-[22px]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="yazili-kullanim" className="flex items-center gap-2 text-lg font-extrabold text-default">
          <PenLine className="h-5 w-5" aria-hidden="true" /> Yazılı kullanımı
        </h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dönem">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              aria-pressed={windowKey === w.key}
              onClick={() => setWindowKey(w.key)}
              className={`min-h-8 rounded-lg px-3 text-xs font-bold ${windowKey === w.key ? `${r.btnNeon} ${r.btnText}` : r.btnGhost}`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-red-500">{error}</p>}
      {!usage && !error && <div className={`h-24 animate-pulse rounded-xl ${r.item}`} aria-hidden="true" />}

      {stats && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className={`flex flex-col gap-1 px-3 py-3 text-center ${r.stat}`}>
              <dt className={r.label}>{s.label}</dt>
              <dd className={`text-2xl ${r.statValue}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {usage && (
        usage.exams.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">Yazılı başına kullanım (tüm zamanlar)</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Yazılı (tüm zamanlar)</th>
                  <th className="px-2 text-center font-semibold">Kişi</th>
                  <th className="px-2 text-center font-semibold">Açılan</th>
                  <th className="px-2 text-center font-semibold">AI&apos;ye gönderilen</th>
                  <th className="px-2 text-center font-semibold">Ort. puan</th>
                </tr>
              </thead>
              <tbody>
                {usage.exams.map((e) => (
                  <tr key={e.exam_id} className="border-t border-[var(--edge)]">
                    <td className="py-2 pr-3 text-default">
                      <span className="font-semibold">{e.grade} {e.lesson}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{e.term}. dönem {e.exam_no}. yazılı</span>
                    </td>
                    <td className="px-2 text-center font-bold text-default">{e.users}</td>
                    <td className="px-2 text-center text-default">{e.attempts}</td>
                    <td className="px-2 text-center text-default">{e.sent}</td>
                    <td className="px-2 text-center text-default">{e.avg_pct == null ? '—' : `%${e.avg_pct}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--edge)] p-5 text-center text-sm text-muted-foreground">Henüz yazılı açan öğrenci yok.</p>
        )
      )}
      <p className="text-xs text-muted-foreground">Admin ve test hesapları sayılmaz. &quot;AI&apos;ye gönderilen&quot; = cevapları yapay zekâya gönderilen yazılı (puanlama başarısız olduysa da sayılır).</p>
    </section>
  );
}
