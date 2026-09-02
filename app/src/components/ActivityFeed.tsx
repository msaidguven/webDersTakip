'use client';

import React from 'react';
import Link from 'next/link';
import { Activity } from '../models/types';
import { Icon, getIconColorClasses } from './icons';

function ChevronLink({ href, children, className }: { href: string; children: React.ReactNode; className: string }) {
  return (
    <Link href={href} className={`group/link inline-flex items-center gap-1 ${className}`}>
      {children}
      <Icon name="chevron-right" size={14} className="transition-transform group-hover/link:translate-x-0.5" />
    </Link>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;
  return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (score >= 70) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
  if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
}

// Barın/rozetlerin rengini ikon rengiyle (bkz. getIconColorClasses) eşleştirir — yarım kalan
// denemeler şu an hep 'orange' geliyor ama iconColor genişlerse buton/çubuk da uyum sağlasın.
const ACCENT_BY_ICON_COLOR: Record<string, { bar: string; edge: string; text: string; chip: string }> = {
  orange: { bar: 'bg-amber-500', edge: 'bg-amber-500/70', text: 'text-amber-400', chip: 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20' },
  purple: { bar: 'bg-indigo-500', edge: 'bg-indigo-500/70', text: 'text-indigo-400', chip: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/20' },
  pink: { bar: 'bg-pink-500', edge: 'bg-pink-500/70', text: 'text-pink-400', chip: 'bg-pink-500/10 border-pink-500/25 text-pink-400 hover:bg-pink-500/20' },
  teal: { bar: 'bg-cyan-500', edge: 'bg-cyan-500/70', text: 'text-cyan-400', chip: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/20' },
  rose: { bar: 'bg-rose-500', edge: 'bg-rose-500/70', text: 'text-rose-400', chip: 'bg-rose-500/10 border-rose-500/25 text-rose-400 hover:bg-rose-500/20' },
};

function getAccent(iconColor: string) {
  return ACCENT_BY_ICON_COLOR[iconColor] ?? ACCENT_BY_ICON_COLOR.orange;
}

interface ActivityItemProps {
  activity: Activity;
}

// Yarım kalan bir deneme, tamamlanmış bir denemeden çok daha fazla dikkat hak ediyor —
// "kaldığın yerden devam et" net bir eylem çağrısı olduğu için kendi kartı, ilerleme çubuğu
// ve çözülen/kalan soru dökümüyle ayrı gösteriliyor (bkz. kullanıcının referans tasarımı,
// 2026-09-02). Metinler kesilmesin diye başlık burada `truncate` DEĞİL satır kırılımı kullanır.
function ResumableActivityCard({ activity }: ActivityItemProps) {
  const accent = getAccent(activity.iconColor);
  // totalQuestionCount = oturuma ATANMIŞ soru sayısı (gerçek toplam). questionCount ise
  // "yarım kalan" için test_session_answers satır sayısı — bir soru yeniden denenirse
  // (retry) birden fazla satır oluşabiliyor, bu yüzden ATANMIŞ sayıdan büyük çıkabilir.
  // Önceden ikisinin büyüğü "toplam" sayılıyordu (ör. 10 sorudan 11 gösteriliyordu) —
  // toplam her zaman gerçek atanmış sayı, çözülen de bunu geçemez.
  const total = activity.totalQuestionCount ?? activity.questionCount;
  const solved = Math.min(activity.questionCount, total);
  const remaining = Math.max(0, total - solved);
  const progress = total > 0 ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-default bg-white/[0.03]">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent.edge}`} />
      <div className="p-3 pl-4 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <h4 className="font-semibold text-default text-sm leading-snug break-words">
            {activity.title}
          </h4>
          <ChevronLink
            href={activity.resumeHref!}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap transition-colors ${accent.chip}`}
          >
            Devam Et
          </ChevronLink>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="whitespace-nowrap">{formatRelativeTime(activity.timestamp)}</span>
          <span className="whitespace-nowrap">{solved} / {total} soru</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${accent.bar}`} style={{ width: `${progress}%` }} />
          </div>
          <span className={`text-xs font-semibold shrink-0 ${accent.text}`}>%{progress}</span>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {solved} soru tamamlandı • {remaining} soru kaldı
        </p>
      </div>
    </div>
  );
}

function CompletedActivityRow({ activity }: ActivityItemProps) {
  const scoreClass = getScoreColor(activity.score);

  return (
    <div className="group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl transition-colors hover:bg-white/5">
      <div className="relative shrink-0">
        <div
          className={`absolute inset-0 rounded-lg sm:rounded-xl opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70 ${getIconColorClasses(activity.iconColor)}`}
        />
        <div
          className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${getIconColorClasses(activity.iconColor)}`}
        >
          <Icon name={activity.icon} size={18} className="sm:w-[22px] sm:h-[22px]" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-default group-hover:text-indigo-400 transition-colors truncate text-sm sm:text-base">
          {activity.title}
        </h4>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-sm text-muted-foreground mt-0.5">
          <span className="whitespace-nowrap">{formatRelativeTime(activity.timestamp)}</span>
          <span className="whitespace-nowrap">• {activity.questionCount} soru</span>
          <span className="whitespace-nowrap">• {activity.durationMinutes} dk</span>
        </div>
      </div>

      <div className={`shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold border ${scoreClass}`}>
        %{activity.score}
      </div>
    </div>
  );
}

function ActivityItem({ activity }: ActivityItemProps) {
  const isResumable = activity.isComplete === false && !!activity.resumeHref;
  return isResumable ? <ResumableActivityCard activity={activity} /> : <CompletedActivityRow activity={activity} />;
}

interface ActivityFeedProps {
  activities: Activity[];
  seeAllHref?: string;
  title?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
}

export function ActivityFeed({
  activities,
  seeAllHref,
  title = 'Son Aktiviteler',
  emptyTitle = 'Henüz bir aktivite yok',
  emptySubtitle = 'İlk testini çöz, burada görünmeye başlasın.',
}: ActivityFeedProps) {
  const hasResumable = activities.some((a) => a.isComplete === false && !!a.resumeHref);

  return (
    <div className="rounded-xl sm:rounded-2xl bg-surface-elevated border border-default overflow-hidden">
      {/* Üst marka şeridi — sitedeki diğer kartlarla aynı gradyan dili */}
      <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-default flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activities.length > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          <h3 className="font-semibold text-default text-sm sm:text-base">{title}</h3>
        </div>
        {seeAllHref && (
          <ChevronLink
            href={seeAllHref}
            className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-indigo-400 transition-colors"
          >
            Tümünü Gör
          </ChevronLink>
        )}
      </div>

      {/* Activity List */}
      <div className="p-2 sm:p-3 space-y-2">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>

      {hasResumable && (
        <div className="mx-2 sm:mx-3 mb-2 sm:mb-3 flex items-start gap-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10 px-3 py-2.5">
          <span className="text-sm shrink-0">✨</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Kaldığın yerden devam edebilirsin — ilerlemen otomatik olarak kaydedilir.
          </p>
        </div>
      )}

      {/* Empty State (hidden when there are activities) */}
      {activities.length === 0 && (
        <div className="p-6 sm:p-8 text-center">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/10 blur-lg" />
            <div className="relative w-full h-full rounded-full bg-white/5 border border-default flex items-center justify-center">
              <span className="text-xl sm:text-2xl">📋</span>
            </div>
          </div>
          <p className="text-default font-medium text-sm sm:text-base mb-1">{emptyTitle}</p>
          <p className="text-muted-foreground text-xs sm:text-sm">{emptySubtitle}</p>
        </div>
      )}
    </div>
  );
}
