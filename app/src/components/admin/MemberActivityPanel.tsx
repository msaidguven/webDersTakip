'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MemberDetail from './MemberDetail';
import MemberDirectory from './MemberDirectory';
import { formatDateTime, memberLabel, PERIODS, safeDecode } from './memberActivityFormat';

type TopPage = { path: string; views: number; users: number };
type Summary = {
  days: number;
  active_today: number;
  views_today: number;
  active_period: number;
  views_period: number;
  top_pages: TopPage[];
};
type FeedRow = { user_id: string; full_name: string | null; username: string | null; path: string; created_at: string };

// Admin → Üye Aktivitesi: sol kenarda tüm üyeler, sağda seçili üyenin detayı; üye seçilmemişse
// dönem özeti. Ziyaretler PageViewTracker → user_page_views (anonimler Google Analytics'te).
export default function MemberActivityPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedUserId = searchParams.get('user');
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/member-activity?days=${days}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Yüklenemedi');
      setSummary(data.summary);
      setFeed(data.feed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sunucudan veri çekme
    load();
  }, [load]);

  function selectUser(userId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (userId) params.set('user', userId);
    else params.delete('user');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }

  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Dönem" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                days === p.days ? 'bg-indigo-500 text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={load}
          className="ml-auto rounded-lg bg-indigo-500/20 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/30"
        >
          Yenile
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <MemberDirectory selectedUserId={selectedUserId} onSelect={selectUser} />

        <div className="min-w-0 space-y-6">
          {selectedUserId ? (
            <MemberDetail
              key={selectedUserId}
              userId={selectedUserId}
              days={days}
              periodLabel={periodLabel}
              onClose={() => selectUser(null)}
            />
          ) : (
            <>
              <section aria-label="Özet" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Bugün aktif üye" value={summary?.active_today} loading={loading} />
                <StatTile label="Bugün sayfa görüntüleme" value={summary?.views_today} loading={loading} />
                <StatTile label="Dönemde aktif üye" value={summary?.active_period} loading={loading} />
                <StatTile label="Dönemde sayfa görüntüleme" value={summary?.views_period} loading={loading} />
              </section>

              <section className="rounded-xl border border-border bg-card">
                <header className="border-b border-border px-4 py-3">
                  <h2 className="font-semibold text-foreground">En çok ziyaret edilen sayfalar</h2>
                  <p className="text-xs text-muted-foreground">Görüntüleme · farklı üye sayısı</p>
                </header>
                {summary && summary.top_pages.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Bu dönemde kayıt yok</p>
                ) : (
                  <ol className="divide-y divide-border max-h-[360px] overflow-y-auto">
                    {(summary?.top_pages ?? []).map((p, i) => (
                      <li key={p.path} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                        <a
                          href={p.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate text-indigo-600 dark:text-indigo-400 hover:underline"
                          title={safeDecode(p.path)}
                        >
                          {safeDecode(p.path)}
                        </a>
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                          {p.views} · {p.users} üye
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card">
                <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                  <h2 className="font-semibold text-foreground">Son ziyaretler (tüm üyeler)</h2>
                  <span className="ml-auto text-xs text-muted-foreground">Son 100 kayıt · 90 günden eskiler silinir</span>
                </header>
                {!loading && feed.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">Henüz kayıt yok</p>
                ) : (
                  <ol className="divide-y divide-border max-h-[480px] overflow-y-auto">
                    {feed.map((row, i) => (
                      <li key={`${row.created_at}-${row.user_id}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                        <time dateTime={row.created_at} className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatDateTime(row.created_at)}
                        </time>
                        <button
                          type="button"
                          onClick={() => selectUser(row.user_id)}
                          className="w-40 shrink-0 truncate text-left text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="Bu üyenin detayını göster"
                        >
                          {memberLabel(row)}
                        </button>
                        <a
                          href={row.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 truncate text-indigo-600 dark:text-indigo-400 hover:underline"
                          title={safeDecode(row.path)}
                        >
                          {safeDecode(row.path)}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{loading && value === undefined ? '…' : (value ?? 0)}</p>
    </div>
  );
}
