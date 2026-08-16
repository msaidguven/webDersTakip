// app/ders/Mufredatoverviewclient.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronRight,
  GraduationCap,
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
  is_active?: boolean;
  topicCount?: number | null;
  topics?: UnitTopic[];
};

export type GradeLessonOption = {
  id: number;
  name: string;
  slug: string | null;
  icon: string | null;
};

export type GradeOption = {
  id: number;
  name: string;
  slug: string | null;
  icon?: string | null;
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
  allGrades?: GradeOption[];
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
  allGrades = [],
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

  // Sınıf değişince aynı dersi yeni sınıfta açmayı dener — o sınıfta bu ders yoksa
  // hedef sayfa zaten "Ders bulunamadı" durumunu gösteriyor.
  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSlug = e.target.value;
    if (!selectedSlug || selectedSlug === gradeSlug) return;
    router.push(lessonSlug ? `/${selectedSlug}/${lessonSlug}` : `/${selectedSlug}`);
  };

  const showLessonDropdown = !!gradeSlug && gradeLessons.filter((l) => l.slug).length > 1;
  const showGradeDropdown = allGrades.filter((g) => g.slug).length > 1;

  const totalTopics = units.reduce((sum, u) => sum + (u.topics?.length ?? u.topicCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#f9fafb] text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">

        {/* Üst gezinme — sadece mobil/tablet; masaüstünde yerini soldaki sabit sidebar'lar alır */}
        <div className="flex items-center justify-between gap-2 mb-5 sm:mb-6 lg:hidden">
          <Link
            href={changeLessonsHref}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors shrink-0"
          >
            <span className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </span>
            Dersler
          </Link>
          <div className="flex items-center gap-2">
            {showGradeDropdown && (
              <div className="relative shrink-0">
                <select
                  value={gradeSlug ?? ''}
                  onChange={handleGradeChange}
                  aria-label="Sınıf değiştir"
                  className="appearance-none max-w-[110px] truncate pl-3 pr-7 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                >
                  {allGrades.filter((g) => g.slug).map((g) => (
                    <option key={g.id} value={g.slug ?? ''}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
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
        </div>

        <div className="lg:grid lg:grid-cols-[200px_230px_1fr] lg:gap-6 lg:items-start">

          {/* Sınıflar sidebar — sadece masaüstü, her zaman açık (aç/kapa yok) */}
          <aside className="hidden lg:block sticky top-[96px]">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 p-3">
              <h2 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 mb-2">
                <GraduationCap className="h-3.5 w-3.5" /> Sınıflar
              </h2>
              <nav className="space-y-1">
                {allGrades.filter((g) => g.slug).map((g) => {
                  const active = g.slug === gradeSlug;
                  return (
                    <Link
                      key={g.id}
                      href={lessonSlug ? `/${g.slug}/${lessonSlug}` : `/${g.slug}`}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-bold truncate transition-all ${
                        active
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0">{g.icon || '📘'}</span>
                      <span className="truncate">{g.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Dersler sidebar — seçili sınıfın dersleri, sadece masaüstü */}
          <aside className="hidden lg:block sticky top-[96px]">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50 p-3">
              <h2 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 mb-2">
                <BookOpen className="h-3.5 w-3.5" /> Dersler
              </h2>
              <nav className="space-y-1">
                {gradeLessons.filter((l) => l.slug).map((l) => {
                  const active = l.slug === lessonSlug;
                  return (
                    <Link
                      key={l.id}
                      href={`/${gradeSlug}/${l.slug}`}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-bold truncate transition-all ${
                        active
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0">{l.icon || '📘'}</span>
                      <span className="truncate">{l.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* İçerik */}
          <div className="min-w-0">

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
            const isDraftUnit = unit.is_active === false;

            return (
              <div
                key={unit.id}
                id={unit.slug ?? undefined}
                className={`scroll-mt-4 rounded-2xl border overflow-hidden ${isDraftUnit ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'}`}
              >
                <div className={`p-4 sm:p-5 flex items-center gap-3 sm:gap-4 border-b ${isDraftUnit ? 'border-amber-100' : 'border-slate-100'}`}>
                  <div className={`h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0 ${isDraftUnit ? 'bg-amber-500' : accent.badge}`}>
                    {displayNo}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-base sm:text-lg font-black truncate ${isDraftUnit ? 'text-amber-800' : 'text-slate-900'}`}>{unit.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {isDraftUnit && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                          Taslak
                        </span>
                      )}
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

        <p className="text-[11px] text-slate-400 font-medium mt-6 text-center">
          Haftaların tarih aralıkları MEB takvimine göredir ve değişiklik gösterebilir.
        </p>

          </div>
        </div>
      </div>
    </div>
  );
}
