// app/ders/Mufredatoverviewclient.tsx

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  PieChart,
  RefreshCw,
} from 'lucide-react';

export type UnitTopic = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
};

export type Unit = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
  topicCount?: number | null;
  topics?: UnitTopic[];
};

export type GradeLessonOption = {
  id: number;
  name: string;
  slug: string | null;
  icon: string | null;
};

interface MufredatOverviewClientProps {
  gradeName: string;
  lessonName: string;
  lessonIcon?: string | null;
  gradeSlug: string | null;
  lessonSlug: string | null;
  gradeId: string;
  lessonId: string;
  units: Unit[];
  currentWeek: number;
  totalWeeks?: number;
  gradeLessons?: GradeLessonOption[];
}

function academicYearLabel(): string {
  const now = new Date();
  const y = now.getFullYear();
  // Eğitim-öğretim yılı Eylül'de başlar
  return now.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function ProgressRing({ percent, tone }: { percent: number; tone: 'active' | 'done' | 'idle' }) {
  const size = 44;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  const trackColor = tone === 'idle' ? '#e2e8f0' : tone === 'done' ? '#d1fae5' : '#ede9fe';
  const barColor = tone === 'done' ? '#10b981' : tone === 'active' ? '#6366f1' : '#94a3b8';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={barColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-700">
        {tone === 'done' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : `${percent}%`}
      </div>
    </div>
  );
}

export default function MufredatOverviewClient({
  gradeName,
  lessonName,
  lessonIcon,
  gradeSlug,
  lessonSlug,
  gradeId,
  lessonId,
  units,
  currentWeek,
  totalWeeks = 38,
  gradeLessons = [],
}: MufredatOverviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeUnit = useMemo(
    () => units.find((u) => currentWeek >= (u.start_week || 1) && currentWeek <= (u.end_week || totalWeeks)),
    [units, currentWeek, totalWeeks]
  );

  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(activeUnit?.id ?? null);

  const goToWeek = (weekNo: number) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('hafta', String(weekNo));

    if (gradeSlug && lessonSlug) {
      router.push(`/${gradeSlug}/${lessonSlug}/icerik?${params.toString()}`);
    } else {
      params.set('sinif', gradeId);
      params.set('ders', lessonId);
      router.push(`/ders/icerik?${params.toString()}`);
    }
  };

  const goToTopic = (unitSlug: string | null, topicSlug: string | null, fallbackWeek: number) => {
    if (gradeSlug && lessonSlug && unitSlug && topicSlug) {
      router.push(`/${gradeSlug}/${lessonSlug}/${unitSlug}/${topicSlug}`);
      return;
    }
    goToWeek(fallbackWeek);
  };

  const changeLessonsHref = gradeSlug ? `/${gradeSlug}` : '/';

  const handleLessonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSlug = e.target.value;
    if (!gradeSlug || !selectedSlug || selectedSlug === lessonSlug) return;
    router.push(`/${gradeSlug}/${selectedSlug}`);
  };

  const showLessonDropdown = !!gradeSlug && gradeLessons.filter((l) => l.slug).length > 1;

  const unitStats = useMemo(
    () =>
      units.map((unit) => {
        const start = unit.start_week || 1;
        const end = unit.end_week || totalWeeks;
        const isCompleted = currentWeek > end;
        const isActive = currentWeek >= start && currentWeek <= end;
        const weeksInUnit = Math.max(1, end - start + 1);
        const weeksDone = Math.min(weeksInUnit, Math.max(0, currentWeek - start));
        const progressPct = isCompleted ? 100 : Math.round((weeksDone / weeksInUnit) * 100);
        return { unit, start, end, isCompleted, isActive, weeksInUnit, progressPct };
      }),
    [units, currentWeek, totalWeeks]
  );

  const weekProgressPct = Math.min(100, Math.max(0, Math.round((currentWeek / totalWeeks) * 100)));
  const overallProgressPct = unitStats.length
    ? Math.round(unitStats.reduce((sum, s) => sum + s.progressPct, 0) / unitStats.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#f9fafb] text-slate-800 font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">

        {/* Üst gezinme */}
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <Link
            href={changeLessonsHref}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <span className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </span>
            Dersler
          </Link>
          {showLessonDropdown ? (
            <div className="relative shrink-0">
              <select
                value={lessonSlug ?? ''}
                onChange={handleLessonChange}
                aria-label="Ders değiştir"
                className="appearance-none max-w-[150px] sm:max-w-[220px] truncate pl-3 pr-8 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
              >
                {gradeLessons.filter((l) => l.slug).map((l) => (
                  <option key={l.id} value={l.slug ?? ''}>
                    {l.icon || '📘'} {l.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          ) : (
            <Link
              href={changeLessonsHref}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Dersleri Değiştir
            </Link>
          )}
        </div>

        {/* Ders başlığı */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl shrink-0 shadow-lg shadow-indigo-500/20">
            {lessonIcon || '📘'}
          </div>
          <div className="min-w-0">
            <span className="inline-block text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 mb-1.5">
              {gradeName}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">{lessonName}</h1>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">{academicYearLabel()} Eğitim Öğretim Yılı</p>
          </div>
        </div>

        {/* İstatistik kartları */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-8">
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold text-slate-400 mb-1 sm:mb-2">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" /> <span className="truncate">Şu anki hafta</span>
            </div>
            <div className="text-base sm:text-2xl font-black text-slate-900 truncate">{currentWeek}. Hafta</div>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold text-slate-400 mb-1 sm:mb-2">
              <BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" /> <span className="truncate">İlerleme</span>
            </div>
            <div className="text-base sm:text-2xl font-black text-slate-900 truncate">{currentWeek}<span className="text-slate-400 text-[11px] sm:text-sm font-bold">/{totalWeeks}</span></div>
            <div className="h-1 sm:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5 sm:mt-2">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${weekProgressPct}%` }} />
            </div>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-bold text-slate-400 mb-1 sm:mb-2">
              <PieChart className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" /> <span className="truncate">Genel</span>
            </div>
            <div className="text-base sm:text-2xl font-black text-slate-900">%{overallProgressPct}</div>
            <div className="h-1 sm:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5 sm:mt-2">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${overallProgressPct}%` }} />
            </div>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-3 sm:mb-4">Üniteler</h2>

        <div className="space-y-3">
          {unitStats.map(({ unit, start, end, isCompleted, isActive, progressPct }) => {
            const isExpanded = expandedUnitId === unit.id;
            const statusLabel = isCompleted ? 'Tamamlandı' : isActive ? 'Şu anki ünite' : 'Başlanmadı';
            const topics = unit.topics ?? [];

            // Konuları haftalara eşit dağıtarak yaklaşık ilerleme durumu hesapla
            const weeksInUnit = Math.max(1, end - start + 1);
            const topicsWithWeek = topics.map((t, idx) => ({
              ...t,
              week: Math.min(end, start + Math.floor((idx * weeksInUnit) / Math.max(1, topics.length))),
            }));
            const currentTopicIdx = isActive
              ? topicsWithWeek.findIndex((t) => t.week >= currentWeek)
              : isCompleted
                ? -1
                : 0;

            return (
              <div
                key={unit.id}
                className={`
                  rounded-2xl border overflow-hidden transition-shadow
                  ${isActive ? 'border-indigo-200 bg-indigo-50/40 shadow-sm' : 'border-slate-200 bg-white'}
                `}
              >
                <button
                  onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                  className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div
                      className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center text-lg font-black shrink-0
                        ${isActive ? 'bg-indigo-600 text-white shadow-sm' : isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : unit.order_no}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">{unit.title}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-slate-400">Hafta {start}&ndash;{end}</span>
                        {isActive && (
                          <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> {statusLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <ProgressRing percent={progressPct} tone={isCompleted ? 'done' : isActive ? 'active' : 'idle'} />
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                    {topicsWithWeek.length === 0 ? (
                      <p className="text-xs font-bold text-slate-400 pl-1">Bu ünite için konu bulunamadı.</p>
                    ) : (
                      <div className="relative pl-1">
                        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />
                        <div className="space-y-1">
                          {topicsWithWeek.map((topic, idx) => {
                            const isDone = currentTopicIdx === -1 ? true : idx < currentTopicIdx;
                            const isCurrent = idx === currentTopicIdx;
                            const isPending = !isDone && !isCurrent;

                            return (
                              <div
                                key={topic.id}
                                className={`relative flex items-center gap-3 py-2.5 pl-0 pr-2 rounded-xl ${isCurrent ? 'bg-white' : ''}`}
                              >
                                <div className="relative z-10 shrink-0 h-[30px] w-[30px] rounded-full flex items-center justify-center bg-[#f9fafb]">
                                  {isDone ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                  ) : isCurrent ? (
                                    <span className="h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-indigo-100" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-slate-300" />
                                  )}
                                </div>

                                <button
                                  onClick={() => goToTopic(unit.slug, topic.slug, topic.week)}
                                  className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
                                >
                                  <div className="min-w-0">
                                    <div className={`text-sm font-black truncate ${isPending ? 'text-slate-400' : 'text-slate-900'}`}>
                                      {unit.order_no}.{idx + 1} {topic.title}
                                    </div>
                                    <div className={`text-xs font-bold ${isDone ? 'text-emerald-600' : isCurrent ? 'text-indigo-600' : 'text-slate-400'}`}>
                                      {isDone ? 'Tamamlandı' : isCurrent ? `Şu an öğreniyorsun · Hafta ${topic.week}` : 'Başlanmadı'}
                                    </div>
                                  </div>

                                  {isCurrent ? (
                                    <span className="flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-black hover:bg-indigo-700 transition-colors">
                                      Devam Et <ArrowRight className="h-3.5 w-3.5" />
                                    </span>
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {units.length === 0 && (
            <div className="text-center p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400 font-bold">
              Bu ders için ünite bulunamadı.
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 font-medium mt-6 text-center">
          Haftaların tarih aralıkları MEB takvimine göredir ve değişiklik gösterebilir.
        </p>
      </div>
    </div>
  );
}
