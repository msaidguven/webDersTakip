// app/ders/Mufredatoverviewclient.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import AdSlot from '@/app/src/components/AdSlot';

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

// Ünite kartlarına saf görsel çeşitlilik katmak için — herhangi bir ilerleme/durum anlamı taşımaz.
const UNIT_ACCENTS = [
  { badge: 'bg-indigo-600', chip: 'bg-indigo-50 text-indigo-600' },
  { badge: 'bg-purple-600', chip: 'bg-purple-50 text-purple-600' },
  { badge: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-600' },
  { badge: 'bg-amber-600', chip: 'bg-amber-50 text-amber-600' },
  { badge: 'bg-rose-600', chip: 'bg-rose-50 text-rose-600' },
  { badge: 'bg-sky-600', chip: 'bg-sky-50 text-sky-600' },
];

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
  gradeLessons = [],
}: MufredatOverviewClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const totalTopics = units.reduce((sum, u) => sum + (u.topics?.length ?? u.topicCount ?? 0), 0);

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
        <div className="flex items-center gap-4 mb-7 sm:mb-8">
          <div className="h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl shrink-0 shadow-lg shadow-indigo-500/20">
            {lessonIcon || '📘'}
          </div>
          <div className="min-w-0">
            <span className="inline-block text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 mb-1.5">
              {gradeName}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 truncate">{lessonName}</h1>
            <p className="text-xs sm:text-sm font-bold text-slate-400 mt-0.5">
              {academicYearLabel()} · {units.length} Ünite · {totalTopics} Konu
            </p>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-3 sm:mb-4">Üniteler</h2>

        <div className="space-y-4">
          {units.map((unit, unitIdx) => {
            const displayNo = unitIdx + 1;
            const topics = unit.topics ?? [];
            const accent = UNIT_ACCENTS[unitIdx % UNIT_ACCENTS.length];
            const start = unit.start_week;
            const end = unit.end_week;

            return (
              <div key={unit.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4 border-b border-slate-100">
                  <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0 ${accent.badge}`}>
                    {displayNo}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 truncate">{unit.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {start != null && end != null && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          <Calendar className="h-3 w-3" /> Hafta {start}&ndash;{end}
                        </span>
                      )}
                      <span className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full ${accent.chip}`}>
                        {topics.length} Konu
                      </span>
                    </div>
                  </div>
                </div>

                {topics.length === 0 ? (
                  <p className="text-xs font-bold text-slate-400 px-4 sm:px-5 py-4">Bu ünite için konu bulunamadı.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {topics.map((topic, idx) => (
                      <button
                        key={topic.id}
                        onClick={() => goToTopic(unit.slug, topic.slug, start ?? currentWeek)}
                        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-slate-50 transition-colors group"
                      >
                        <span className="text-xs font-black text-slate-300 shrink-0 w-8">{displayNo}.{idx + 1}</span>
                        <div className="min-w-0 flex-1 text-sm font-bold text-slate-900 truncate">{topic.title}</div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
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

        <AdSlot slot="0000000001" className="mt-6" />

        <p className="text-[11px] text-slate-400 font-medium mt-6 text-center">
          Haftaların tarih aralıkları MEB takvimine göredir ve değişiklik gösterebilir.
        </p>
      </div>
    </div>
  );
}
