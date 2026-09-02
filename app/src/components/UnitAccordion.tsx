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

function TopicActionButton({
  href,
  label,
  completed,
}: {
  href?: string;
  label: string;
  completed?: boolean;
}) {
  const base = 'px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors';

  if (!href) {
    return (
      <span className={`${base} bg-white/5 text-muted-foreground/40 cursor-not-allowed`} aria-disabled="true">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} ${
        completed
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
          : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'
      }`}
    >
      {label}
    </Link>
  );
}

// accent, konunun bağlı olduğu ünitenin durumunu yansıtır (tamamlandıysa yeşil, devam
// ediyorsa indigo) — dal çizgisi ve rozet bu renkte olunca konu, hangi üniteye ait
// olduğu görsel olarak da belli olacak şekilde ünitesiyle eşleşir.
function TopicRow({ topic, accent }: { topic: UnitTopic; accent: 'emerald' | 'indigo' }) {
  const fullyDone = topic.contentCompleted && topic.quizCompleted;
  const stubColor = accent === 'emerald' ? 'bg-emerald-500/40' : 'bg-indigo-500/40';
  const badgeClass = fullyDone
    ? 'bg-emerald-500/15 text-emerald-500'
    : accent === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-400'
      : 'bg-indigo-500/15 text-indigo-400';
  const hoverBorder = accent === 'emerald' ? 'hover:border-emerald-500/40' : 'hover:border-indigo-500/40';
  const barColor = fullyDone ? 'bg-emerald-500' : accent === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';

  return (
    <div className="relative flex items-center pl-5 pr-1">
      {/* Ünite çizgisinden konuya kısa bir "dal" — alt kategori olduğunu belli eder */}
      <span className={`absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 rounded-full ${stubColor}`} />
      <div
        className={`flex flex-1 min-w-0 flex-col gap-1.5 rounded-xl border border-default/70 bg-surface-elevated px-3 py-2.5 sm:px-3.5 transition-colors ${hoverBorder}`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${badgeClass}`}>
            <Icon name={fullyDone ? 'check' : 'bookmark'} size={11} />
          </span>
          <p className="text-[13px] sm:text-sm font-medium text-default flex-1 min-w-0 truncate">{topic.title}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <TopicActionButton href={topic.contentHref} label="Konu Anlatımı" completed={topic.contentCompleted} />
            <TopicActionButton href={topic.quizHref} label="Soru Çöz" completed={topic.quizCompleted} />
          </div>
        </div>

        {/* Ünitenin kendi soru sayısı + yüzdelik ilerleme çubuğunun konu bazlı karşılığı
            (bkz. kullanıcının "üniteler için olan bunu konular için de yap" isteği,
            2026-09-02) — hiç soru yoksa (yalnızca konu anlatımı olan bir konu) gösterilmez. */}
        {topic.totalQuestions > 0 && (
          <div className="flex items-center gap-2 pl-8 sm:pl-9">
            <div className="h-1.5 flex-1 max-w-[160px] rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${topic.quizProgress}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {topic.solvedQuestions}/{topic.totalQuestions} Soru • %{topic.quizProgress}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Ünite → Konu hiyerarşisi: her ünite tıklanınca açılıp altındaki konuları gösteren tek bir
// akordeon satırı (bkz. kullanıcının "üniteler açılır menü olsun, konular altında görünsün"
// isteği, 2026-09-02). Her konunun iki BAĞIMSIZ butonu var — içerik yoksa/soru yoksa ilgili
// buton pasif (href'siz, tıklanamaz) gösterilir; "Test Çöz" (ünite geneli) linki akordeonu
// açıp kapamadan çalışır.
export function UnitAccordion({ units, topicsByUnitId, defaultOpenUnitId }: UnitAccordionProps) {
  const [openUnitId, setOpenUnitId] = useState<string | null>(defaultOpenUnitId);

  useEffect(() => {
    setOpenUnitId(defaultOpenUnitId);
  }, [defaultOpenUnitId]);

  return (
    <div className="rounded-2xl bg-surface-elevated border border-default divide-y divide-default overflow-hidden">
      {units.map((unit) => {
        const isOpen = openUnitId === unit.id;
        const topics = topicsByUnitId[unit.id] ?? [];

        return (
          <div key={unit.id}>
            <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3.5">
              <button
                type="button"
                onClick={() => setOpenUnitId(isOpen ? null : unit.id)}
                className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left"
              >
                <UnitStatusIcon status={unit.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-default truncate">{unit.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{unit.subtitle}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 max-w-[220px] rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          unit.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${unit.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">%{unit.progress}</span>
                  </div>
                </div>
              </button>

              {unit.href && (
                <Link
                  href={unit.href}
                  className="hidden sm:inline-flex shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                >
                  Test Çöz
                </Link>
              )}

              <button
                type="button"
                onClick={() => setOpenUnitId(isOpen ? null : unit.id)}
                aria-label={isOpen ? 'Üniteyi kapat' : 'Üniteyi aç'}
                className="shrink-0 text-muted-foreground p-1"
              >
                <Icon name="chevron-right" size={18} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {isOpen && (
              <div className="bg-black/15 pl-9 sm:pl-11 pr-2 sm:pr-3 py-2.5">
                {topics.length === 0 ? (
                  <p className="pl-5 py-2.5 text-sm text-muted-foreground">Bu ünitede henüz konu yok.</p>
                ) : (
                  <div
                    className={`space-y-2 border-l-2 ${
                      unit.status === 'completed' ? 'border-emerald-500/30' : 'border-indigo-500/30'
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
