'use client';

import React from 'react';
import Link from 'next/link';
import { TopicProgress } from '../models/types';
import { Icon } from './icons';
import { ProgressRowList } from './ProgressRowList';

interface UnitTestInfo {
  href?: string;
  solvedQuestions: number;
  totalQuestions: number;
}

interface TopicProgressListProps {
  unitTitle: string | null;
  topics: TopicProgress[];
  unitTest?: UnitTestInfo;
}

function UnitTestRow({ unitTest }: { unitTest: UnitTestInfo }) {
  const content = (
    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
        <Icon name="bookmark" size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-default truncate">Ünite Değerlendirme Testi</p>
        <p className="mt-1 text-xs text-muted-foreground">{unitTest.solvedQuestions} / {unitTest.totalQuestions} soru</p>
      </div>
      {unitTest.href && (
        <span className="hidden sm:inline-flex shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20">
          Test Çöz
        </span>
      )}
      <Icon name="chevron-right" size={18} className="shrink-0 text-muted-foreground" />
    </div>
  );
  if (!unitTest.href) return <div>{content}</div>;
  return (
    <Link href={unitTest.href} className="block hover:bg-white/5 transition-colors">
      {content}
    </Link>
  );
}

export function TopicProgressList({ unitTitle, topics, unitTest }: TopicProgressListProps) {
  if (!topics.length) return null;

  const rows = topics.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    progressPercent: t.progressPercent,
    actionLabel: t.actionLabel,
    actionHref: t.actionHref,
  }));

  return (
    <div id="devam-edilen-konular" className="scroll-mt-24">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-default">Devam Edilen Konular</h2>
        {unitTitle && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{unitTitle}</p>}
      </div>
      <ProgressRowList rows={rows}>
        {unitTest && unitTest.totalQuestions > 0 && <UnitTestRow unitTest={unitTest} />}
      </ProgressRowList>
    </div>
  );
}
