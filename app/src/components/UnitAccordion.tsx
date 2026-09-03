'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Unit, UnitTopic } from '../models/types';
import { Icon } from './icons';

interface UnitAccordionProps {
  units: Unit[];
  topicsByUnitId: Record<string, UnitTopic[]>;
  defaultOpenUnitId: string | null;
}

function UnitStatusIcon({ status }: { status: Unit['status'] }) {
  if (status === 'completed') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm shadow-emerald-500/10">
        <Icon name="check" size={16} />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30 shadow-sm shadow-indigo-500/10">
      <Icon name="play" size={14} />
    </span>
  );
}

function TopicActionButton({
  href,
  label,
  completed,
}: {
  href?: string;
  label: string;
  completed?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95';

  if (!href) {
    return (
      <span className={`${base} bg-white/5 text-muted-foreground/40 cursor-not-allowed border border-white/5`} aria-disabled="true">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        completed
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-sm hover:shadow-emerald-500/10'
          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/50 hover:shadow-sm hover:shadow-indigo-500/10'
      }`}
    >
      {label}
    </Link>
  );
}

function TopicRow({ topic, accent }: { topic: UnitTopic; accent: 'emerald' | 'indigo' }) {
  const fullyDone = topic.contentCompleted && topic.quizCompleted;
  const stubColor = accent === 'emerald' ? 'bg-emerald-500/40' : 'bg-indigo-500/40';
  const badgeClass = fullyDone
    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
    : accent === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
      : 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/20';
  const hoverBorder = accent === 'emerald' ? 'hover:border-emerald-500/40 hover:shadow-emerald-500/5' : 'hover:border-indigo-500/40 hover:shadow-indigo-500/5';
  const barGradient = fullyDone
    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
    : accent === 'emerald'
      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
      : 'bg-gradient-to-r from-indigo-500 to-purple-500';

  return (
    <div className="relative flex items-center pl-4 sm:pl-5 pr-1">
      {/* Ünite çizgisinden konuya kısa bir "dal" */}
      <span className={`absolute left-0 top-1/2 h-0.5 w-3.5 sm:w-4 -translate-y-1/2 rounded-full ${stubColor}`} />
      <div
        className={`flex flex-1 min-w-0 flex-col gap-2 rounded-xl sm:rounded-2xl border border-default/70 bg-surface-elevated/90 p-3 sm:p-3.5 transition-all duration-200 hover:shadow-lg ${hoverBorder}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${badgeClass}`}>
              <Icon name={fullyDone ? 'check' : 'bookmark'} size={12} />
            </span>
            <p className="text-xs sm:text-sm font-semibold text-default truncate">{topic.title}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            <TopicActionButton href={topic.contentHref} label="Konu Anlatımı" completed={topic.contentCompleted} />
            <TopicActionButton href={topic.quizHref} label="Soru Çöz" completed={topic.quizCompleted} />
          </div>
        </div>

        {topic.totalQuestions > 0 && (
          <div className="flex items-center gap-2.5 pl-8 sm:pl-8">
            <div className="h-1.5 flex-1 max-w-[180px] rounded-full bg-zinc-800/80 overflow-hidden p-0.5 border border-white/5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barGradient}`}
                style={{ width: `${topic.quizProgress}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground font-medium shrink-0">
              {topic.solvedQuestions}/{topic.totalQuestions} Soru • %{topic.quizProgress}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function UnitAccordion({ units, topicsByUnitId, defaultOpenUnitId }: UnitAccordionProps) {
  const [openUnitId, setOpenUnitId] = useState<string | null>(defaultOpenUnitId);

  useEffect(() => {
    setOpenUnitId(defaultOpenUnitId);
  }, [defaultOpenUnitId]);

  return (
    <div className="rounded-2xl sm:rounded-3xl bg-surface-elevated/90 border border-default divide-y divide-default/60 overflow-hidden shadow-xl shadow-black/5">
      {units.map((unit) => {
        const isOpen = openUnitId === unit.id;
        const topics = topicsByUnitId[unit.id] ?? [];

        return (
          <div key={unit.id} className={`transition-colors duration-200 ${isOpen ? 'bg-indigo-500/[0.02]' : ''}`}>
            <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-4">
              <button
                type="button"
                onClick={() => setOpenUnitId(isOpen ? null : unit.id)}
                className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left group"
              >
                <UnitStatusIcon status={unit.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm sm:text-base font-bold text-default group-hover:text-indigo-400 transition-colors truncate">
                      {unit.title}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{unit.subtitle}</p>
                  <div className="mt-2 flex items-center gap-2.5">
                    <div className="h-2 flex-1 max-w-[240px] rounded-full bg-zinc-800/80 overflow-hidden p-0.5 border border-white/5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          unit.status === 'completed'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/20'
                            : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-sm shadow-indigo-500/20'
                        }`}
                        style={{ width: `${unit.progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10 shrink-0">
                      %{unit.progress}
                    </span>
                  </div>
                </div>
              </button>

              {unit.href && (
                <Link
                  href={unit.href}
                  className="hidden sm:inline-flex shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/10 transition-all active:scale-95"
                >
                  Test Çöz
                </Link>
              )}

              <button
                type="button"
                onClick={() => setOpenUnitId(isOpen ? null : unit.id)}
                aria-label={isOpen ? 'Üniteyi kapat' : 'Üniteyi aç'}
                className="shrink-0 text-muted-foreground hover:text-default p-1.5 rounded-xl hover:bg-white/5 transition-all"
              >
                <Icon name="chevron-right" size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-90 text-indigo-400' : ''}`} />
              </button>
            </div>

            {isOpen && (
              <div className="bg-black/20 border-t border-default/40 pl-6 sm:pl-10 pr-3 sm:pr-5 py-3 sm:py-4">
                {topics.length === 0 ? (
                  <p className="pl-5 py-2 text-xs sm:text-sm text-muted-foreground italic">Bu ünitede henüz konu yok.</p>
                ) : (
                  <div
                    className={`space-y-2.5 border-l-2 pl-1 sm:pl-2 ${
                      unit.status === 'completed' ? 'border-emerald-500/40' : 'border-indigo-500/40'
                    }`}
                  >
                    {topics.map((topic) => (
                      <TopicRow
                        key={topic.id}
                        topic={topic}
                        accent={unit.status === 'completed' ? 'emerald' : 'indigo'}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
