'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from './icons';

export type ProgressRowStatus = 'completed' | 'in_progress';

export interface ProgressRowData {
  id: string;
  title: string;
  subtitle?: string;
  status: ProgressRowStatus;
  progressPercent: number;
  actionLabel: string;
  actionHref?: string;
}

// Tek satırlık, ilerleme çubuklu liste satırı — hem "Devam Edilen Konular" hem "Üniteler"
// için ortak (bkz. kullanıcının 2026-09-02 tarihli referans tasarımı). Kilit YOK: her satır
// her zaman erişilebilir, sadece tamamlanma durumu gösterilir (bkz. "kilitli üniteler"
// tartışması — hem ünite hem konu seviyesinde kilitleme kaldırıldı).
function StatusIcon({ status }: { status: ProgressRowStatus }) {
  if (status === 'completed') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <Icon name="check" size={14} />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-500">
      <Icon name="play" size={12} />
    </span>
  );
}

function ProgressRow({ row }: { row: ProgressRowData }) {
  const content = (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
      <StatusIcon status={row.status} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-default truncate">{row.title}</p>
        {row.subtitle && <p className="text-xs text-muted-foreground truncate">{row.subtitle}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 max-w-[220px] rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${row.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${row.progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">%{row.progressPercent}</span>
        </div>
      </div>
      {row.actionHref && (
        <span className="hidden sm:inline-flex shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20">
          {row.actionLabel}
        </span>
      )}
      <Icon name="chevron-right" size={18} className="shrink-0 text-muted-foreground" />
    </div>
  );

  if (!row.actionHref) return <div>{content}</div>;
  return (
    <Link href={row.actionHref} className="block hover:bg-white/5 transition-colors">
      {content}
    </Link>
  );
}

export function ProgressRowList({ rows, children }: { rows: ProgressRowData[]; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-elevated border border-default divide-y divide-default overflow-hidden">
      {rows.map((row) => (
        <ProgressRow key={row.id} row={row} />
      ))}
      {children}
    </div>
  );
}
