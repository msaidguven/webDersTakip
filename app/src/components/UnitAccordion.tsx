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
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-emerald-400 text-white shadow-lg shadow-emerald-200/50 transition-all duration-700 hover:scale-110 hover:shadow-emerald-300/70">
        <Icon name="check" size={16} />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-300 to-indigo-400 text-white shadow-lg shadow-indigo-200/50 transition-all duration-700 hover:scale-110 hover:shadow-indigo-300/70">
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
    'px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-700 transform hover:scale-105 active:scale-95';

  if (!href) {
    return (
      <span
        className={`${base} bg-gray-100 text-gray-300 cursor-not-allowed border border-gray-200`}
        aria-disabled="true"
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        completed
          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200/50 hover:shadow-emerald-300/70 hover:bg-emerald-600'
          : 'bg-indigo-500 text-white shadow-md shadow-indigo-200/50 hover:shadow-indigo-300/70 hover:bg-indigo-600'
      }`}
    >
      {label}
    </Link>
  );
}

function TopicRow({ topic, accent }: { topic: UnitTopic; accent: 'emerald' | 'indigo' }) {
  const fullyDone = topic.contentCompleted && topic.quizCompleted;
  const accentColor = accent === 'emerald' ? 'emerald' : 'indigo';
  const badgeClass = fullyDone
    ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
    : `bg-${accentColor}-100 text-${accentColor}-600 border border-${accentColor}-200`;
  const hoverBorder =
    accent === 'emerald'
      ? 'hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/50'
      : 'hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100/50';
  const barColor = fullyDone
    ? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
    : accent === 'emerald'
    ? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
    : 'bg-gradient-to-r from-indigo-400 to-indigo-300';

  return (
    <div className="group relative flex items-center pl-5 pr-1">
      <span
        className={`absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 rounded-full transition-all duration-700 ${
          accent === 'emerald' ? 'bg-emerald-300 group-hover:bg-emerald-400' : 'bg-indigo-300 group-hover:bg-indigo-400'
        }`}
      />
      <div
        className={`flex flex-1 min-w-0 flex-col gap-1.5 rounded-xl bg-white px-3 py-3 sm:px-4 border border-gray-100 shadow-sm transition-all duration-700 ${hoverBorder}`}
      >
        <div className="flex items-start gap-2.5 flex-wrap">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-700 group-hover:scale-110 ${badgeClass}`}
          >
            <Icon name={fullyDone ? 'check' : 'bookmark'} size={12} />
          </span>
          <p className="text-[13px] sm:text-sm font-medium text-gray-800 flex-1 min-w-0 break-words transition-colors duration-700 group-hover:text-gray-900">
            {topic.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <TopicActionButton href={topic.contentHref} label="Konu Anlatımı" completed={topic.contentCompleted} />
            <TopicActionButton href={topic.quizHref} label="Soru Çöz" completed={topic.quizCompleted} />
          </div>
        </div>

        {topic.totalQuestions > 0 && (
          <div className="flex items-center gap-2 pl-9 sm:pl-10">
            <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${barColor}`}
                style={{ width: `${topic.quizProgress}%` }}
              />
            </div>
            <span className="text-[10px] sm:text-[11px] text-gray-400 shrink-0 font-mono">
              {topic.solvedQuestions}/{topic.totalQuestions} • %{topic.quizProgress}
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
    <div className="rounded-2xl bg-white border border-gray-200 shadow-xl shadow-gray-100/50 overflow-hidden">
      {units.map((unit, index) => {
        const isOpen = openUnitId === unit.id;
        const topics = topicsByUnitId[unit.id] ?? [];
        const isCompleted = unit.status === 'completed';
        const accentColor = isCompleted ? 'emerald' : 'indigo';

        return (
          <div
            key={unit.id}
            className={`transition-all duration-700 ${
              index !== units.length - 1 ? 'border-b-2 border-gray-200' : ''
            }`}
          >
            <div
              className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-5 transition-all duration-700 
                ${isCompleted 
                  ? 'bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-white border-l-4 border-emerald-300 hover:border-emerald-400 hover:from-emerald-100 hover:via-emerald-100/60' 
                  : 'bg-gradient-to-r from-indigo-50 via-indigo-50/80 to-white border-l-4 border-indigo-300 hover:border-indigo-400 hover:from-indigo-100 hover:via-indigo-100/60'
                } 
                shadow-sm hover:shadow-md`}
            >
              <button
                type="button"
                onClick={() => setOpenUnitId(isOpen ? null : unit.id)}
                className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left group"
              >
                <UnitStatusIcon status={unit.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate transition-colors duration-700 group-hover:text-gray-900">
                    {unit.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate transition-colors duration-700 group-hover:text-gray-600">
                    {unit.subtitle}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 max-w-[220px] rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-300'
                            : 'bg-gradient-to-r from-indigo-400 to-indigo-300'
                        }`}
                        style={{ width: `${unit.progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-500 font-mono">%{unit.progress}</span>
                  </div>
                </div>
              </button>

              {unit.href && (
                <Link
                  href={unit.href}
                  className="hidden sm:inline-flex shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-indigo-400 shadow-md shadow-indigo-200/50 transition-all duration-700 hover:scale-105 hover:shadow-indigo-300/70 active:scale-95"
                >
                  Test Çöz
                </Link>
              )}

              <button
                type="button"
                onClick={() => setOpenUnitId(isOpen ? null : unit.id)}
                aria-label={isOpen ? 'Üniteyi kapat' : 'Üniteyi aç'}
                className="shrink-0 text-gray-400 p-1 transition-all duration-700 hover:text-gray-600 hover:scale-110 active:scale-95"
              >
                <Icon
                  name="chevron-right"
                  size={18}
                  className={`transition-all duration-700 ${isOpen ? 'rotate-90' : ''}`}
                />
              </button>
            </div>

            <div
              className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              aria-hidden={!isOpen}
            >
              <div className="overflow-hidden">
                <div
                  className={`bg-gray-50/50 px-4 sm:px-5 py-3 transition-opacity duration-500 ${
                    isOpen ? 'opacity-100 delay-150' : 'opacity-0'
                  }`}
                >
                  {topics.length === 0 ? (
                    <p className="pl-5 py-2.5 text-sm text-gray-400 italic">Bu ünitede henüz konu yok.</p>
                  ) : (
                    <div
                      className={`space-y-2 border-l-2 transition-all duration-700 ${
                        isCompleted ? 'border-emerald-200' : 'border-indigo-200'
                      }`}
                    >
                      {topics.map((topic) => (
                        <TopicRow
                          key={topic.id}
                          topic={topic}
                          accent={isCompleted ? 'emerald' : 'indigo'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}