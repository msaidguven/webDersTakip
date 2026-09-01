'use client';

import React from 'react';
import Link from 'next/link';
import { TopicProgress, TopicProgressStatus } from '../models/types';
import { Icon } from './icons';

interface TopicProgressListProps {
  unitTitle: string | null;
  topics: TopicProgress[];
}

const STATUS_LABEL: Record<TopicProgressStatus, string> = {
  not_started: 'Başlanmadı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
};

const STATUS_CLASSES: Record<TopicProgressStatus, string> = {
  not_started: 'bg-zinc-800 text-muted-foreground border-default',
  in_progress: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

function StatusPill({ label, status }: { label: string; status: TopicProgressStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] sm:text-xs font-semibold ${STATUS_CLASSES[status]}`}>
      {label}: {STATUS_LABEL[status]}
    </span>
  );
}

// Panelde her konu için Anlatım ve Sorular AYRI AYRI gösterilir — birleşik tek bir
// "konu tamamlandı" rozeti bilinçli olarak yok (bkz. docs/site-iyilestirme-plani.md
// tartışması, 2026-09-02): biri bitmiş olsa da diğeri bağımsız olarak devam ediyor olabilir.
export function TopicProgressList({ unitTitle, topics }: TopicProgressListProps) {
  if (!topics.length) return null;

  return (
    <div id="devam-edilen-konular" className="scroll-mt-24">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-default">Devam Edilen Konular</h2>
        {unitTitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{unitTitle}</p>}
      </div>
      <div className="space-y-3">
        {topics.map((topic) => (
          <div key={topic.id} className="rounded-2xl bg-surface-elevated border border-default p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-default truncate">{topic.title}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <StatusPill label="Anlatım" status={topic.contentStatus} />
                  {topic.questionStatus && <StatusPill label="Sorular" status={topic.questionStatus} />}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {topic.contentHref && (
                  <Link
                    href={topic.contentHref}
                    className="px-3 py-2 rounded-xl bg-zinc-800 text-default text-xs sm:text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                  >
                    <Icon name="book" size={14} /> Konu Anlatımı
                  </Link>
                )}
                {topic.quizHref && (
                  <Link
                    href={topic.quizHref}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs sm:text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center gap-1.5"
                  >
                    <Icon name="play" size={14} /> Soru Çöz
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
