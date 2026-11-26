'use client';

// Admin anasayfası "Etkileşimli dersler" (2026-11-03): worker'ın üretim durumu (öğrenciye görünen, ses bekleyen,
// üretilen, vazgeçilen, sırada), son 7 gün hızı, elle yazılmış v1/v2 ders kısayolları ve kullanım. Veri
// /api/admin/etkilesimli-ders (admin_interactive_lesson_stats RPC'si + konu linkleri).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Gamepad2, RefreshCw } from 'lucide-react';
import { HAND_WRITTEN_LESSON_TOPIC_IDS } from '@/app/src/lib/interactiveLesson/handWritten';
import r from '@/app/src/components/robotic/robotic.module.css';

type Usage = { opens: number; finishes: number; students: number; teachers: number; guests: number };
type Row = { topic_id: number; title: string; grade: string; lesson: string; href?: string | null };
type HandWrittenRow = Row & { version: number };
type SchemaVersion = '3.1' | '3' | '2' | '1' | null;
type Stats = {
  status: { visible: number; awaiting_voice: number; in_progress: number; given_up: number; queued: number };
  last7: { sections: number; lessons_done: number; quota_skips: number };
  usage: Record<'today' | 'd7' | 'd30' | 'all', Usage>;
  handwritten?: HandWrittenRow[];
  recent: (Row & { status: string; voice_done: boolean; updated_at: string; schema_version?: SchemaVersion })[];
  top: (Row & { opens: number; finishes: number })[];
};

const WINDOWS = [
  { key: 'today', label: 'Bugün' },
  { key: 'd7', label: 'Son 7 gün' },
  { key: 'd30', label: 'Son 30 gün' },
  { key: 'all', label: 'Tümü' },
] as const;

const STATUS_LABEL: Record<string, string> = { ready: 'hazır', partial: 'yarım', generating: 'üretiliyor', failed: 'hata' };

export function AdminInteractiveLessons() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [requeueingId, setRequeueingId] = useState<number | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [windowKey, setWindowKey] = useState<(typeof WINDOWS)[number]['key']>('d7');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/etkilesimli-ders', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) setError(data?.error || 'Etkileşimli ders raporu yüklenemedi');
        else {
          setError(null);
          setStats(data);
        }
      })
      .catch(() => !cancelled && setError('Etkileşimli ders raporu yüklenemedi'));
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const handleRegenerateV31 = async (topicId: number, title: string) => {
    if (requeueingId !== null) return;
    setRequeueingId(topicId);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/etkilesimli-ders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_v31', topicId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'v3.1 yenileme sırasına alınamadı');
      } else {
        setNotice(`"${title}" v3.1 ile yeniden üretim sırasına alındı (worker sonraki çalışmada üretecek).`);
        setReloadTick((n) => n + 1);
      }
    } catch {
      setError('v3.1 yenileme isteği başarısız oldu');
    } finally {
      setRequeueingId(null);
    }
  };

  const u = stats?.usage[windowKey];
  const st = stats?.status;
  const tiles = st
    ? [
        { label: 'Öğrenciye açık', value: st.visible + HAND_WRITTEN_LESSON_TOPIC_IDS.length, sub: `${HAND_WRITTEN_LESSON_TOPIC_IDS.length}’ü elle yazılmış` },
        { label: 'Ses bekliyor', value: st.awaiting_voice, sub: 'Hazır, robot sesleri eksik' },
        { label: 'Üretiliyor', value: st.in_progress, sub: 'Yarım ya da yeniden denenecek' },
        { label: 'Sırada', value: st.queued, sub: st.given_up ? `${st.given_up} konu üretilemedi` : 'Henüz başlanmadı' },
      ]
    : [];

  return (
    <section aria-labelledby="etkilesimli-dersler" className={`flex flex-col gap-4 p-5 sm:p-7 ${r.panel} rounded-[22px]`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="etkilesimli-dersler" className="flex items-center gap-2 text-lg font-extrabold text-default">
          <Gamepad2 className="h-5 w-5" aria-hidden="true" /> Etkileşimli dersler
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
      {notice && <p role="status" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {!stats && !error && <div className={`h-24 animate-pulse rounded-xl ${r.item}`} aria-hidden="true" />}

      {stats && (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className={`flex flex-col gap-1 px-4 py-3 text-center ${r.stat}`}>
                <dt className={r.label}>{t.label}</dt>
                <dd className={`text-2xl ${r.statValue}`}>{t.value}</dd>
                <dd className="text-xs text-muted-foreground">{t.sub}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Son 7 gün: {stats.last7.sections} bölüm üretildi, {stats.last7.lessons_done} ders tamamlandı; worker {stats.last7.quota_skips} çalışmada Gemini kotası dolu diye bekledi.
          </p>

          {!!stats.handwritten?.length && (
            <List
              title="Altın örnekler (elle yazılmış v3 / v2 / v1)"
              rows={stats.handwritten.map((x) => ({
                key: x.topic_id,
                label: x.title,
                sub: `${x.grade} ${x.lesson}`.trim(),
                right: x.version === 3 ? 'v3 YENİ' : x.version === 2 ? 'v2 OYUN' : 'v1',
                highlight: x.version >= 2,
                href: x.href,
              }))}
              empty=""
            />
          )}

          {u && (
            <div className={`flex flex-col gap-1 px-4 py-3 ${r.stat}`}>
              <p className={r.label}>Kullanım</p>
              <p className="text-sm text-default">
                <b className="text-lg">{u.opens}</b> kez başlandı · {u.students} öğrenci · {u.teachers} öğretmen · {u.guests} misafir açılışı
              </p>
              <p className="text-xs text-muted-foreground">{u.opens > 0 ? `%${Math.round((u.finishes / u.opens) * 100)} sonuna kadar bitirildi` : 'Henüz kullanım yok'}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <List
              title="Son üretilenler"
              rows={stats.recent.map((x) => {
                const ver = x.schema_version ?? null;
                const canRegen = ver !== '3.1' && x.status !== 'generating' && x.status !== 'partial';
                return {
                  key: x.topic_id,
                  label: x.title,
                  sub: `${x.grade} ${x.lesson}`,
                  versionBadge: ver ? `v${ver}` : undefined,
                  isV31: ver === '3.1',
                  right: x.status === 'ready' ? (x.voice_done ? 'öğrenciye açık' : 'ses bekliyor') : (STATUS_LABEL[x.status] ?? x.status),
                  href: x.href,
                  onRegenerate: canRegen ? () => void handleRegenerateV31(x.topic_id, x.title) : undefined,
                  regenerating: requeueingId === x.topic_id,
                };
              })}
              empty="Henüz üretilen ders yok."
            />
            <List
              title="En çok açılanlar (tüm zamanlar)"
              rows={stats.top.map((x) => ({
                key: x.topic_id,
                label: x.title,
                sub: `${x.grade} ${x.lesson}`,
                right: `${x.opens} açılış · ${x.finishes} bitiş`,
                href: x.href,
              }))}
              empty="Henüz açılan ders yok."
            />
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">Admin ve test hesapları kullanımda sayılmaz. Ders öğrenciye robot sesleri tamamlanınca açılır.</p>
    </section>
  );
}

type ListRow = {
  key: number;
  label: string;
  sub: string;
  right: string;
  href?: string | null;
  highlight?: boolean;
  versionBadge?: string;
  isV31?: boolean;
  onRegenerate?: () => void;
  regenerating?: boolean;
};

function List({ title, rows, empty }: { title: string; rows: ListRow[]; empty: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className={r.label}>{title}</h3>
      {rows.length ? (
        <ol className="flex flex-col gap-1.5">
          {rows.map((row) => {
            const leftContent = (
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold text-default">
                  <span className="truncate">{row.label}</span>
                  {row.versionBadge && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none ${
                        row.isV31
                          ? 'border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'border border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {row.versionBadge}
                    </span>
                  )}
                  {row.href && <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>
              </span>
            );

            const rightContent = (
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={
                    row.highlight
                      ? 'shrink-0 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-extrabold text-white'
                      : 'shrink-0 text-right text-xs text-muted-foreground'
                  }
                >
                  {row.right}
                </span>
                {row.onRegenerate && (
                  <button
                    type="button"
                    disabled={row.regenerating}
                    onClick={row.onRegenerate}
                    title="v3.1 mikro-laboratuvarlarla yeniden üretim sırasına al"
                    className={`inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition disabled:opacity-50 ${r.btnGhost}`}
                  >
                    <RefreshCw className={`h-3 w-3 ${row.regenerating ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>v3.1</span>
                  </button>
                )}
              </span>
            );

            return (
              <li key={row.key}>
                {row.href && !row.onRegenerate ? (
                  <Link href={row.href} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition hover:-translate-y-0.5 ${r.item}`}>
                    {leftContent}
                    {rightContent}
                  </Link>
                ) : (
                  <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${r.item}`}>
                    {row.href ? (
                      <Link href={row.href} className="min-w-0 flex-1 transition hover:opacity-80">
                        {leftContent}
                      </Link>
                    ) : (
                      leftContent
                    )}
                    {rightContent}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--edge)] p-4 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
