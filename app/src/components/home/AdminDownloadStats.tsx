'use client';

// Admin anasayfası "İndirmeler" (2026-10-29): ders notu PDF'i, öğretmenin yazılı kâğıdı (PDF/cevap anahtarı/Word) ve
// "konudan soru seç" Word dışa aktarması kaç kez, kaç kişi tarafından indirilmiş. Veri /api/admin/indirmeler
// (admin_download_stats RPC'si); admin ve test hesapları sayılmaz.
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';

type Kind = 'topic_pdf' | 'paper_download' | 'question_export';
type Counts = { downloads: number; users: number; cached: number };
type TopicRow = { topic_id: number; title: string; grade: string; lesson: string; downloads: number; users: number };
type ExamRow = { exam_id: number; grade: string; lesson: string; term: number; exam_no: number; downloads: number; users: number };
type Stats = { summary: Record<'today' | 'd7' | 'd30' | 'all', Record<Kind, Counts>>; topics: TopicRow[]; exams: ExamRow[] };

const WINDOWS = [
  { key: 'today', label: 'Bugün' },
  { key: 'd7', label: 'Son 7 gün' },
  { key: 'd30', label: 'Son 30 gün' },
  { key: 'all', label: 'Tümü' },
] as const;

const KINDS: { key: Kind; label: string }[] = [
  { key: 'topic_pdf', label: 'Ders notu PDF' },
  { key: 'paper_download', label: 'Yazılı kâğıdı (öğretmen)' },
  { key: 'question_export', label: 'Soru Word (öğretmen)' },
];

export function AdminDownloadStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]['key']>('d7');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/indirmeler')
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) setError(data?.error || 'İndirme istatistikleri yüklenemedi');
        else setStats(data);
      })
      .catch(() => !cancelled && setError('İndirme istatistikleri yüklenemedi'));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = stats?.summary[windowKey];
  const pdf = counts?.topic_pdf;

  return (
    <section aria-labelledby="indirmeler" className={`flex flex-col gap-4 p-5 sm:p-7 ${r.panel} rounded-[22px]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="indirmeler" className="flex items-center gap-2 text-lg font-extrabold text-default">
          <Download className="h-5 w-5" aria-hidden="true" /> İndirmeler
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
      {!stats && !error && <div className={`h-24 animate-pulse rounded-xl ${r.item}`} aria-hidden="true" />}

      {counts && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {KINDS.map((k) => (
            <div key={k.key} className={`flex flex-col gap-1 px-4 py-3 text-center ${r.stat}`}>
              <dt className={r.label}>{k.label}</dt>
              <dd className={`text-2xl ${r.statValue}`}>{counts[k.key].downloads}</dd>
              <dd className="text-xs text-muted-foreground">{counts[k.key].users} kişi</dd>
            </div>
          ))}
        </dl>
      )}
      {pdf && pdf.downloads > 0 && (
        <p className="text-xs text-muted-foreground">
          Ders notu PDF&apos;lerinin %{Math.round((pdf.cached / pdf.downloads) * 100)}&apos;i önbellekten geldi (Chrome açılmadı); {pdf.downloads - pdf.cached} PDF yeni üretildi.
        </p>
      )}

      {stats && (stats.topics.length > 0 || stats.exams.length > 0) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <RankList title="En çok indirilen ders notları (tüm zamanlar)" rows={stats.topics.map((t) => ({ key: t.topic_id, label: t.title, sub: `${t.grade} ${t.lesson}`, downloads: t.downloads, users: t.users }))} />
          <RankList title="En çok indirilen yazılı kâğıtları (tüm zamanlar)" rows={stats.exams.map((e) => ({ key: e.exam_id, label: `${e.grade} ${e.lesson}`, sub: `${e.term}. dönem ${e.exam_no}. yazılı`, downloads: e.downloads, users: e.users }))} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">Admin ve test hesapları sayılmaz. İndirmek için giriş gerekir, misafir indirmesi yoktur. Yazılı kâğıdı sayısı PDF, cevap anahtarı ve Word indirmelerinin toplamıdır.</p>
    </section>
  );
}

function RankList({ title, rows }: { title: string; rows: { key: number; label: string; sub: string; downloads: number; users: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={r.label}>{title}</h3>
      {rows.length ? (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.key} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${r.item}`}>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-default">{row.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                <b className="text-sm text-default">{row.downloads}</b> indirme · {row.users} kişi
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--edge)] p-4 text-center text-sm text-muted-foreground">Henüz indirme yok.</p>
      )}
    </div>
  );
}
