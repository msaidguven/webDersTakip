'use client';

import React, { useEffect, useState } from 'react';
import { memberLabel, relativeTime, ROLE_LABELS } from './memberActivityFormat';

export type DirectoryMember = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  grade_name: string | null;
  registered_at: string | null;
  last_seen_at: string | null;
};

type Props = {
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
};

// Üye Aktivitesi sol kenar çubuğu: tüm üyeler, son görülmeye göre. Arama sunucuda yapılır.
export default function MemberDirectory({ selectedUserId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ search });
        const res = await fetch(`/api/admin/member-activity/members?${params.toString()}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Yüklenemedi');
        setItems(data.items);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Yüklenemedi');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  return (
    <aside className="rounded-xl border border-border bg-card lg:sticky lg:top-20 lg:self-start">
      <header className="space-y-2 border-b border-border px-4 py-3">
        <h2 className="font-semibold text-foreground">Üyeler</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ad veya kullanıcı adı ara"
          aria-label="Üye ara"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </header>

      {error && <p className="px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

      {!loading && !error && items.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Üye bulunamadı</p>
      ) : (
        <ul className="divide-y divide-border max-h-[320px] lg:max-h-[calc(100vh-14rem)] overflow-y-auto">
          {items.map((m) => {
            const active = m.user_id === selectedUserId;
            return (
              <li key={m.user_id}>
                <button
                  type="button"
                  onClick={() => onSelect(m.user_id)}
                  aria-pressed={active}
                  className={`w-full px-4 py-2.5 text-left transition-colors ${active ? 'bg-indigo-500/10' : 'hover:bg-accent'}`}
                >
                  <span className="block truncate text-sm font-medium text-foreground">{memberLabel(m)}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">
                      {m.grade_name ?? ROLE_LABELS[m.role ?? ''] ?? '—'}
                      {m.username && m.full_name && ` · @${m.username}`}
                    </span>
                    <span className="shrink-0">{m.last_seen_at ? relativeTime(m.last_seen_at) : 'hiç girmedi'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
