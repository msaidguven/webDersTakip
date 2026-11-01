'use client';

// Admin anasayfası "Slayt ve sesli anlatım kullanımı" (2026-11-01): etkileşimli ders bütün konulara yayılınca
// slayt ve sesli anlatım kalsın mı kararı için — kim açıyor (öğretmen/öğrenci/misafir) ve sonuna kadar kullanıyor mu.
// Veri /api/admin/icerik-kullanimi (admin_content_usage_stats RPC'si); admin ve test hesapları sayılmaz.
import { useEffect, useState } from 'react';
import { Presentation } from 'lucide-react';
import r from '@/app/src/components/robotic/robotic.module.css';

type Kind = 'slides_open' | 'slides_finish' | 'narration_play' | 'narration_finish';
type Counts = { events: number; teachers: number; students: number; guests: number };
type TopicRow = { topic_id: number; title: string; grade: string; lesson: string; slides: number; narration: number };
type Stats = { summary: Record<'today' | 'd7' | 'd30' | 'all', Record<Kind, Counts>>; topics: TopicRow[] };

const WINDOWS = [
  { key: 'today', label: 'Bugün' },
  { key: 'd7', label: 'Son 7 gün' },
  { key: 'd30', label: 'Son 30 gün' },
  { key: 'all', label: 'Tümü' },
] as const;

const ITEMS = [
  { open: 'slides_open', finish: 'slides_finish', label: 'Slayt', verb: 'açılış', done: 'sona kadar izlendi' },
  { open: 'narration_play', finish: 'narration_finish', label: 'Sesli anlatım', verb: 'başlatma', done: 'sona kadar dinlendi' },
] as const;

export function AdminContentUsage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]['key']>('d7');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/icerik-kullanimi')
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) setError(data?.error || 'Kullanım istatistikleri yüklenemedi');
        else setStats(data);
      })
      .catch(() => !cancelled && setError('Kullanım istatistikleri yüklenemedi'));
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = stats?.summary[windowKey];

  return (
    <section aria-labelledby="icerik-kullanimi" className={`flex flex-col gap-4 p-5 sm:p-7 ${r.panel} rounded-[22px]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="icerik-kullanimi" className="flex items-center gap-2 text-lg font-extrabold text-default">
          <Presentation className="h-5 w-5" aria-hidden="true" /> Slayt ve sesli anlatım kullanımı
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
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ITEMS.map((it) => {
            const open = counts[it.open];
            const finish = counts[it.finish];
            return (
              <div key={it.label} className={`flex flex-col gap-1 px-4 py-3 text-center ${r.stat}`}>
                <dt className={r.label}>{it.label}</dt>
                <dd className={`text-2xl ${r.statValue}`}>
                  {open.events} <span className="text-sm font-semibold text-muted-foreground">{it.verb}</span>
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {open.teachers} öğretmen · {open.students} öğrenci · {open.guests} misafir açılışı
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {open.events > 0 ? `%${Math.round((finish.events / open.events) * 100)} ${it.done}` : 'Henüz kullanım yok'}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {stats && stats.topics.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className={r.label}>En çok kullanılan konular (tüm zamanlar)</h3>
          <ol className="flex flex-col gap-1.5">
            {stats.topics.map((t) => (
              <li key={t.topic_id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${r.item}`}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-default">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.grade} {t.lesson}</span>
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <b className="text-sm text-default">{t.slides}</b> slayt · <b className="text-sm text-default">{t.narration}</b> sesli
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Admin ve test hesapları sayılmaz. Öğretmen/öğrenci sayısı farklı kişidir; misafir sayısı açılış sayısıdır. Aynı kişi aynı konuyu bir oturumda bir kez sayılır.
      </p>
    </section>
  );
}
