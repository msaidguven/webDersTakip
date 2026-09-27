'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type TopPage = { path: string; views: number; users: number };
type ActiveMember = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  views: number;
  pages: number;
  last_view_at: string;
  last_path: string;
};
type Summary = {
  days: number;
  active_today: number;
  views_today: number;
  active_period: number;
  views_period: number;
  top_pages: TopPage[];
  members: ActiveMember[];
};
type FeedRow = { user_id: string; full_name: string | null; username: string | null; path: string; created_at: string };

const PERIODS = [
  { days: 1, label: 'Son 24 saat' },
  { days: 7, label: 'Son 7 gün' },
  { days: 30, label: 'Son 30 gün' },
  { days: 90, label: 'Son 90 gün' },
];

const ROLE_LABELS: Record<string, string> = { student: 'Öğrenci', teacher: 'Öğretmen', admin: 'Admin' };

function safeDecode(path: string): string {
  try { return decodeURIComponent(path); } catch { return path; }
}

function memberLabel(m: { full_name: string | null; username: string | null }): string {
  return m.full_name || (m.username ? `@${m.username}` : 'İsimsiz üye');
}

function relativeTime(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'az önce';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} dk önce`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Admin → Üye Aktivitesi: giriş yapmış üyelerin sayfa ziyaretleri (PageViewTracker →
// user_page_views). Anonim ziyaretçiler burada yok, onlar Google Analytics'te.
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
      const params = new URLSearchParams({ days: String(days) });
      if (selectedUserId) params.set('user', selectedUserId);
      const res = await fetch(`/api/admin/member-activity?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Yüklenemedi');
      setSummary(data.summary);
      setFeed(data.feed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [days, selectedUserId]);

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

  const selectedMember = summary?.members.find((m) => m.user_id === selectedUserId) ?? null;
  const selectedLabel = selectedMember ? memberLabel(selectedMember) : feed[0] ? memberLabel(feed[0]) : 'Seçili üye';

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

      <section aria-label="Özet" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Bugün aktif üye" value={summary?.active_today} loading={loading} />
        <StatTile label="Bugün sayfa görüntüleme" value={summary?.views_today} loading={loading} />
        <StatTile label="Dönemde aktif üye" value={summary?.active_period} loading={loading} />
        <StatTile label="Dönemde sayfa görüntüleme" value={summary?.views_period} loading={loading} />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Üyeler</h2>
            <p className="text-xs text-muted-foreground">Dönem içinde siteye giren üyeler, en son gezinen üstte. Geçmişini görmek için üyeye tıkla.</p>
          </header>
          {summary && summary.members.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Bu dönemde kayıt yok</p>
          ) : (
            <ul className="divide-y divide-border max-h-[480px] overflow-y-auto">
              {(summary?.members ?? []).map((m) => {
                const active = m.user_id === selectedUserId;
                return (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      onClick={() => selectUser(active ? null : m.user_id)}
                      aria-pressed={active}
                      className={`w-full px-4 py-3 text-left transition-colors ${active ? 'bg-indigo-500/10' : 'hover:bg-accent'}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium text-foreground">
                          {memberLabel(m)}
                          {m.username && m.full_name && <span className="ml-1.5 text-xs font-normal text-muted-foreground">@{m.username}</span>}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground" title={formatDateTime(m.last_view_at)}>
                          {relativeTime(m.last_view_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate" title={safeDecode(m.last_path)}>Son: {safeDecode(m.last_path)}</span>
                        <span className="shrink-0">
                          {ROLE_LABELS[m.role ?? ''] ?? '—'} · {m.views} görüntüleme · {m.pages} sayfa
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2 rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">En çok ziyaret edilen sayfalar</h2>
            <p className="text-xs text-muted-foreground">Görüntüleme · farklı üye sayısı</p>
          </header>
          {summary && summary.top_pages.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Bu dönemde kayıt yok</p>
          ) : (
            <ol className="divide-y divide-border max-h-[480px] overflow-y-auto">
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
      </div>

      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="font-semibold text-foreground">
            {selectedUserId ? `${selectedLabel} — ziyaret geçmişi` : 'Son ziyaretler (tüm üyeler)'}
          </h2>
          {selectedUserId && (
            <button
              type="button"
              onClick={() => selectUser(null)}
              className="rounded-lg bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
            >
              × Tüm üyeleri göster
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{selectedUserId ? 'Son 300 kayıt' : 'Son 100 kayıt'} · 90 günden eskiler silinir</span>
        </header>
        {!loading && feed.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Henüz kayıt yok</p>
        ) : (
          <ol className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {feed.map((row, i) => (
              <li key={`${row.created_at}-${row.user_id}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                <time dateTime={row.created_at} className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(row.created_at)}
                </time>
                {!selectedUserId && (
                  <button
                    type="button"
                    onClick={() => selectUser(row.user_id)}
                    className="w-40 shrink-0 truncate text-left text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Bu üyenin geçmişini göster"
                  >
                    {memberLabel(row)}
                  </button>
                )}
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
