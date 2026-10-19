'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthlySummary } from '@/app/src/components/progress/MonthlySummary';
import { MonthlyTable } from '@/app/src/components/progress/MonthlyTable';
import { istanbulToday } from '@/app/src/lib/progressActivity';
import { monthLabel, shiftMonth, summarizeMonth, type MonthlyActivityRow } from '@/app/src/lib/monthlyActivity';
import { formatDate, formatDateTime, memberLabel, percent, relativeTime, safeDecode } from './memberActivityFormat';
import type { Acquisition } from '@/app/src/lib/acquisition';

type ChecklistItem = { label: string; done: boolean };
type MemberDetailData = {
  profile: {
    full_name: string | null;
    username: string | null;
    grade_name: string | null;
    school_name: string | null;
    branch: string | null;
    daily_goal: number | null;
    onboarding_completed: boolean;
    registered_at: string | null;
    last_seen_at: string | null;
    signup_method: 'email' | 'google' | null;
    acquisition: Acquisition | null;
    checklist: ChecklistItem[];
  };
  period: { days: number; active_days: number; answered: number; correct: number; views: number; pages: number };
  totals: { answered: number; correct: number; first_week_answered: number; reached_10_first_week: boolean };
};
type FeedRow = { path: string; created_at: string };
type MonthlyRow = MonthlyActivityRow & { lesson_name: string; lesson_order: number };

type Props = {
  userId: string;
  days: number;
  periodLabel: string;
  onClose: () => void;
};

function signupLabel(method: MemberDetailData['profile']['signup_method']): string {
  if (method === 'email') return 'E-posta ile';
  if (method === 'google') return 'Google ile';
  return 'Bilinmiyor (eski kayıt)';
}

function referrerLabel(acq: Acquisition | null): string {
  if (!acq) return 'Bilinmiyor';
  if (acq.referrer_host) return acq.referrer_host;
  if (acq.referrer_path) return `Site içi: ${acq.referrer_path}`;
  return 'Doğrudan giriş';
}

function deviceLabel(type: Acquisition['device_type']): string {
  if (type === 'mobile') return 'Telefon';
  if (type === 'tablet') return 'Tablet';
  if (type === 'desktop') return 'Bilgisayar';
  return 'Bilinmiyor';
}

function campaignLabel(acq: Acquisition | null): string {
  const parts = [acq?.utm_source, acq?.utm_medium, acq?.utm_campaign].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

// Üye Aktivitesi sağ panel: profil doluluğu, dönem özeti, aylık ders takip çizelgesi, sayfa geçmişi.
export default function MemberDetail({ userId, days, periodLabel, onClose }: Props) {
  const [detail, setDetail] = useState<MemberDetailData | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setDetail(null);
      setError(null);
      try {
        const [detailRes, feedRes] = await Promise.all([
          fetch(`/api/admin/member-activity/members/${userId}?days=${days}`, { signal: controller.signal }),
          fetch(`/api/admin/member-activity?user=${userId}`, { signal: controller.signal }),
        ]);
        const detailData = await detailRes.json();
        const feedData = await feedRes.json();
        if (!detailRes.ok) throw new Error(detailData.error || 'Yüklenemedi');
        if (!feedRes.ok) throw new Error(feedData.error || 'Yüklenemedi');
        setDetail(detailData.detail);
        setFeed(feedData.feed);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Yüklenemedi');
      }
    }
    load();
    return () => controller.abort();
  }, [userId, days]);

  if (error) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</div>;
  }

  if (!detail) {
    return <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Yükleniyor...</div>;
  }

  const { profile, period, totals } = detail;
  const doneCount = profile.checklist.filter((c) => c.done).length;
  const name = memberLabel(profile);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-foreground">{name}</h2>
            <p className="text-xs text-muted-foreground">
              {profile.username && profile.full_name && `@${profile.username} · `}
              {profile.grade_name ?? 'Sınıf seçilmemiş'}
              {profile.school_name && ` · ${profile.school_name}`}
              {profile.branch && ` · ${profile.branch}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
          >
            × Kapat
          </button>
        </header>

        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Profil doluluğu ({doneCount}/{profile.checklist.length})</p>
            <ul className="flex flex-wrap gap-1.5">
              {profile.checklist.map((c) => (
                <li
                  key={c.label}
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    c.done ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {c.done ? '✓' : '○'} {c.label}
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Kayıt</dt>
            <dd className="text-foreground">{profile.registered_at ? formatDate(profile.registered_at) : '—'}</dd>
            <dt className="text-muted-foreground">Son görülme</dt>
            <dd className="text-foreground" title={profile.last_seen_at ? formatDateTime(profile.last_seen_at) : undefined}>
              {profile.last_seen_at ? `${relativeTime(profile.last_seen_at)} (${formatDate(profile.last_seen_at)})` : 'hiç girmedi'}
            </dd>
            <dt className="text-muted-foreground">Kayıt yöntemi</dt>
            <dd className="text-foreground">{signupLabel(profile.signup_method)}</dd>
            <dt className="text-muted-foreground">İlk sayfa</dt>
            <dd className="break-all text-foreground">{profile.acquisition?.landing_path ?? '—'}</dd>
            <dt className="text-muted-foreground">Geldiği yer</dt>
            <dd className="text-foreground">{referrerLabel(profile.acquisition)}</dd>
            <dt className="text-muted-foreground">Cihaz</dt>
            <dd className="text-foreground">{deviceLabel(profile.acquisition?.device_type ?? null)}</dd>
            <dt className="text-muted-foreground">Kampanya</dt>
            <dd className="text-foreground">{campaignLabel(profile.acquisition)}</dd>
            <dt className="text-muted-foreground">Günlük hedef</dt>
            <dd className="text-foreground">{profile.daily_goal ?? '—'} soru</dd>
            <dt className="text-muted-foreground">İlk hafta</dt>
            <dd className={totals.reached_10_first_week ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}>
              {totals.first_week_answered} soru {totals.reached_10_first_week ? '· 10 eşiği geçti' : '· 10 eşiğinin altında'}
            </dd>
          </dl>
        </div>
      </section>

      <section aria-label="Dönem özeti" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label={`Aktif gün (${periodLabel})`} value={period.active_days} />
        <StatTile label={`Çözülen soru (${periodLabel})`} value={period.answered} />
        <StatTile label="Doğruluk" value={percent(period.correct, period.answered)} />
        <StatTile label={`Sayfa görüntüleme (${periodLabel})`} value={period.views} />
      </section>

      <p className="text-xs text-muted-foreground">
        Tüm zamanlar: {totals.answered} soru, {percent(totals.correct, totals.answered)} doğru.
      </p>

      <MonthlyChart userId={userId} />

      <section className="rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h3 className="font-semibold text-foreground">Sayfa geçmişi</h3>
          <p className="text-xs text-muted-foreground">Son {feed.length} ziyaret</p>
        </header>
        {feed.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Henüz ziyaret yok</p>
        ) : (
          <ol className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {feed.map((row, i) => (
              <li key={`${row.created_at}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                <time dateTime={row.created_at} className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(row.created_at)}
                </time>
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

// Aylık ders takip çizelgesi: öğrencinin kendi çizelgesiyle aynı tablo (gün × ders, doğru/yanlış).
// Sütunlar seçilen ayda soru çözülen derslerden kurulur.
function MonthlyChart({ userId }: { userId: string }) {
  const currentMonth = istanbulToday().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<MonthlyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setRows(null);
      setError(null);
      try {
        const res = await fetch(`/api/admin/member-activity/members/${userId}/monthly?month=${month}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Yüklenemedi');
        setRows(data.rows);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Yüklenemedi');
      }
    }
    load();
    return () => controller.abort();
  }, [userId, month]);

  const lessons = useMemo(() => {
    const byId = new Map<number, { id: number; name: string; order: number }>();
    for (const r of rows ?? []) {
      if (!byId.has(r.lesson_id)) byId.set(r.lesson_id, { id: r.lesson_id, name: r.lesson_name, order: r.lesson_order });
    }
    return [...byId.values()].sort((a, b) => a.order - b.order).map(({ id, name }) => ({ id, name }));
  }, [rows]);

  return (
    <section aria-label="Aylık ders takip çizelgesi" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-foreground">Aylık ders takip çizelgesi</h3>
        <div className="flex items-center gap-2" role="group" aria-label="Ay seçimi">
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Önceki ay"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:border-indigo-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground" aria-live="polite">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= currentMonth}
            aria-label="Sonraki ay"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:border-indigo-400 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{error}</p>
      ) : rows === null ? (
        <div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-surface-elevated" />
      ) : (
        <>
          <MonthlySummary summary={summarizeMonth(rows)} />
          <MonthlyTable month={month} lessons={lessons} rows={rows} />
        </>
      )}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
