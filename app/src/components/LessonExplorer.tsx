'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { LessonProgress, Unit, UnitTopic } from '../models/types';
import { getLessonColor } from '../lib/homeMapping';
import { Icon } from './icons';

type View = 'lessons' | 'units' | 'topics';
type UnitFilter = 'all' | 'in_progress' | 'completed';

const UNIT_FILTERS: { id: UnitFilter; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'in_progress', label: 'Devam Edenler' },
  { id: 'completed', label: 'Tamamlananlar' },
];

interface LessonExplorerProps {
  lessons: LessonProgress[];
  isLessonsLoading: boolean;
  units: Unit[];
  topicsByUnitId: Record<string, UnitTopic[]>;
  activeUnitId: string | null;
  isSwitchingLesson: boolean;
  gradeName: string | null;
  lessonName: string | null;
  onSelectLesson: (lessonId: string) => void;
}

function ProgressBar({ progress, tone }: { progress: number; tone: 'emerald' | 'indigo' }) {
  const barColor = tone === 'emerald' ? 'bg-gradient-to-r from-emerald-400 to-emerald-300' : 'bg-gradient-to-r from-indigo-400 to-indigo-300';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`} style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground font-mono shrink-0">%{progress}</span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-elevated border border-default p-6 sm:p-8 text-center">
      <p className="text-default font-medium mb-1">{title}</p>
      <p className="text-muted-foreground text-sm mb-4">{subtitle}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-muted-foreground transition-colors hover:text-indigo-500"
    >
      <Icon name="chevron-right" size={14} className="rotate-180" /> {label}
    </button>
  );
}

function TopicActionButton({ href, label, completed }: { href?: string; label: string; completed?: boolean }) {
  const base = 'flex-1 text-center px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all active:scale-95';
  if (!href) {
    return (
      <span className={`${base} bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-muted-foreground cursor-not-allowed border border-gray-200 dark:border-default`} aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} ${
        completed
          ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
          : 'bg-indigo-500 text-white shadow-sm hover:bg-indigo-600'
      }`}
    >
      {label}
    </Link>
  );
}

// Panel anasayfasının ders → ünite → konu gezgini. Tek bir bileşen, hem mobil hem web'de
// aynı şekilde çalışır (kullanıcının isteği: iki ayrı deneyim değil, tek akış). Her seviye
// SADECE kendi kartlarını gösterir — eski accordion'un aksine üniteler ve konular asla aynı
// anda ekranda değil; bir üst seviyeye dönmek için üstte küçük bir geri butonu var.
export function LessonExplorer({
  lessons,
  isLessonsLoading,
  units,
  topicsByUnitId,
  activeUnitId,
  isSwitchingLesson,
  gradeName,
  lessonName,
  onSelectLesson,
}: LessonExplorerProps) {
  const [view, setView] = useState<View>('lessons');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all');

  const selectedUnit = useMemo(() => units.find((u) => u.id === selectedUnitId) ?? null, [units, selectedUnitId]);
  const topics = selectedUnitId ? topicsByUnitId[selectedUnitId] ?? [] : [];
  const filteredUnits = unitFilter === 'all' ? units : units.filter((u) => u.status === unitFilter);

  function handleLessonClick(lessonId: string) {
    onSelectLesson(lessonId);
    setUnitFilter('all');
    setView('units');
  }

  function handleUnitClick(unitId: string) {
    setSelectedUnitId(unitId);
    setView('topics');
  }

  if (view === 'lessons') {
    return (
      <div>
        <h2 className="text-lg sm:text-xl font-semibold text-default mb-4 sm:mb-6">Derslerim</h2>
        {isLessonsLoading ? (
          <SkeletonGrid />
        ) : lessons.length === 0 ? (
          <EmptyState
            title="Henüz bir derse başlamadın"
            subtitle="Dersler burada görünsün diye önce bir sınıf seçip ilk testini çöz."
            actionHref="/"
            actionLabel="Derse Başla"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {lessons.map((lesson, index) => (
              <button
                key={lesson.id}
                onClick={() => handleLessonClick(lesson.id)}
                className="group flex flex-col gap-3 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:p-4 text-left transition-all hover:border-indigo-500/30 hover:bg-surface active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getLessonColor(index)} text-lg shadow-sm transition-transform duration-200 group-hover:scale-105`}
                  >
                    {lesson.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-default truncate">{lesson.name}</p>
                    <p className="text-[11px] text-muted-foreground">{lesson.totalQuestions} Soru</p>
                  </div>
                </div>
                {lesson.totalQuestions > 0 && <ProgressBar progress={lesson.progress} tone={lesson.progress >= 100 ? 'emerald' : 'indigo'} />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === 'units') {
    return (
      <div>
        <BackButton label="Dersler" onClick={() => setView('lessons')} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-default">{lessonName ?? 'Üniteler'}</h2>
            {gradeName && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{gradeName}</p>}
          </div>
          <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
            {UNIT_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setUnitFilter(filter.id)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors rounded-lg whitespace-nowrap ${
                  unitFilter === filter.id
                    ? 'bg-primary/10 text-indigo-400 border border-primary/20'
                    : 'text-muted-foreground hover:text-default hover:bg-white/5'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {isSwitchingLesson ? (
          <SkeletonGrid />
        ) : filteredUnits.length === 0 ? (
          <EmptyState
            title={units.length === 0 ? 'Bu ders için ünite yok' : 'Bu filtreye uyan ünite yok'}
            subtitle={units.length === 0 ? 'Yakında bu ders için üniteler eklenecek.' : 'Farklı bir filtre deneyebilirsin.'}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {filteredUnits.map((unit) => {
              const isCompleted = unit.status === 'completed';
              const isActive = unit.id === activeUnitId;
              return (
                <div
                  key={unit.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-3.5 sm:p-4 transition-all ${
                    isActive ? 'border-indigo-500/40 bg-indigo-500/5' : 'border-default bg-surface-elevated'
                  }`}
                >
                  <button onClick={() => handleUnitClick(unit.id)} className="group flex flex-1 flex-col gap-2 text-left">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-200 group-hover:scale-105 ${
                          isCompleted ? 'bg-gradient-to-br from-emerald-400 to-emerald-500' : 'bg-gradient-to-br from-indigo-400 to-indigo-500'
                        }`}
                      >
                        <Icon name={isCompleted ? 'check' : 'play'} size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-default truncate">{unit.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{unit.subtitle}</p>
                      </div>
                    </div>
                    {unit.totalQuestions > 0 && <ProgressBar progress={unit.progress} tone={isCompleted ? 'emerald' : 'indigo'} />}
                  </button>
                  {unit.href && (
                    <Link
                      href={unit.href}
                      className="text-center px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-indigo-400 shadow-sm transition-transform active:scale-95"
                    >
                      Ünite Testi
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // view === 'topics'
  return (
    <div>
      <BackButton label="Üniteler" onClick={() => { setView('units'); setSelectedUnitId(null); }} />
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-default">{selectedUnit?.title ?? 'Konular'}</h2>
        {lessonName && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{lessonName}</p>}
      </div>

      {topics.length === 0 ? (
        <EmptyState title="Bu ünitede henüz konu yok" subtitle="Yakında bu ünite için konular eklenecek." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {topics.map((topic) => {
            const fullyDone = topic.contentCompleted && topic.quizCompleted;
            return (
              <div key={topic.id} className="flex flex-col gap-3 rounded-2xl border border-default bg-surface-elevated p-3.5 sm:p-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      fullyDone ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    <Icon name={fullyDone ? 'check' : 'bookmark'} size={13} />
                  </span>
                  <p className="text-sm font-medium text-default flex-1 min-w-0 truncate">{topic.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <TopicActionButton href={topic.contentHref} label="Konu Anlatımı" completed={topic.contentCompleted} />
                  <TopicActionButton href={topic.quizHref} label="Soru Çöz" completed={topic.quizCompleted} />
                </div>
                {topic.totalQuestions > 0 && (
                  <div className="flex items-center gap-2">
                    <ProgressBar progress={topic.quizProgress} tone={fullyDone ? 'emerald' : 'indigo'} />
                    <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                      {topic.solvedQuestions}/{topic.totalQuestions}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
