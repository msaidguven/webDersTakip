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
  Layers,
  RefreshCw,
  Sparkles,
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
  {
    badge: 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 shadow-indigo-500/25',
    chip: 'bg-indigo-50/80 text-indigo-700 border border-indigo-200/60',
    border: 'border-slate-200/80 hover:border-indigo-300/80',
    lightGlow: 'from-indigo-50/50 via-white to-white',
  },
  {
    badge: 'bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 shadow-purple-500/25',
    chip: 'bg-purple-50/80 text-purple-700 border border-purple-200/60',
    border: 'border-slate-200/80 hover:border-purple-300/80',
    lightGlow: 'from-purple-50/50 via-white to-white',
  },
  {
    badge: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 shadow-emerald-500/25',
    chip: 'bg-emerald-50/80 text-emerald-700 border border-emerald-200/60',
    border: 'border-slate-200/80 hover:border-emerald-300/80',
    lightGlow: 'from-emerald-50/50 via-white to-white',
  },
  {
    badge: 'bg-gradient-to-br from-amber-500 via-orange-600 to-amber-600 shadow-amber-500/25',
    chip: 'bg-amber-50/80 text-amber-700 border border-amber-200/60',
    border: 'border-slate-200/80 hover:border-amber-300/80',
    lightGlow: 'from-amber-50/50 via-white to-white',
  },
  {
    badge: 'bg-gradient-to-br from-rose-500 via-pink-600 to-rose-600 shadow-rose-500/25',
    chip: 'bg-rose-50/80 text-rose-700 border border-rose-200/60',
    border: 'border-slate-200/80 hover:border-rose-300/80',
    lightGlow: 'from-rose-50/50 via-white to-white',
  },
  {
    badge: 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 shadow-sky-500/25',
    chip: 'bg-sky-50/80 text-sky-700 border border-sky-200/60',
    border: 'border-slate-200/80 hover:border-sky-300/80',
    lightGlow: 'from-sky-50/50 via-white to-white',
  },
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
    <div className="min-h-screen bg-slate-50/70 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Soft Background Accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 relative z-10">

        {/* Üst gezinme — sadece mobil/tablet; masaüstünde yerini soldaki sabit sidebar'lar alır */}
        <div className="flex items-center justify-between gap-3 mb-6 p-3 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm lg:hidden">
          <Link
            href={changeLessonsHref}
            className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-600 hover:text-indigo-600 transition-colors shrink-0"
          >
            <span className="h-8 w-8 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span>Dersler</span>
          </Link>
          <div className="flex items-center gap-2">
            {showGradeDropdown && (
              <div className="relative shrink-0">
                <select
                  value={gradeSlug ?? ''}
                  onChange={handleGradeChange}
                  aria-label="Sınıf değiştir"
                  className="appearance-none max-w-[110px] truncate pl-3 pr-7 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:border-indigo-300 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  {allGrades.filter((g) => g.slug).map((g) => (
                    <option key={g.id} value={g.slug ?? ''}>{g.name}</option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {showLessonDropdown ? (
              <div className="relative shrink-0">
                <select
                  value={lessonSlug ?? ''}
                  onChange={handleLessonChange}
                  aria-label="Ders değiştir"
                  className="appearance-none max-w-[140px] sm:max-w-[200px] truncate pl-3 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:border-indigo-300 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 text-indigo-500" />
                <span>Dersleri Değiştir</span>
              </Link>
            )}
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[200px_230px_1fr] lg:gap-6 lg:items-start">

          {/* Sınıflar sidebar — sadece masaüstü, sabit (sticky) */}
          <aside className="hidden lg:block sticky top-[84px] self-start">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm p-3.5">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2.5 mb-2.5">
                <GraduationCap className="h-4 w-4 text-indigo-500" /> Sınıflar
              </h2>
              <nav className="space-y-1">
                {allGrades.filter((g) => g.slug).map((g) => {
                  const active = g.slug === gradeSlug;
                  return (
                    <Link
                      key={g.id}
                      href={lessonSlug ? `/${g.slug}/${lessonSlug}` : `/${g.slug}`}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold truncate transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-500/30'
                          : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
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
          <aside className="hidden lg:block sticky top-[84px] self-start">
            <div className="rounded-2xl border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm p-3.5">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2.5 mb-2.5">
                <BookOpen className="h-4 w-4 text-purple-500" /> Dersler
              </h2>
              <nav className="space-y-1">
                {gradeLessons.filter((l) => l.slug).map((l) => {
                  const active = l.slug === lessonSlug;
                  return (
                    <Link
                      key={l.id}
                      href={`/${gradeSlug}/${l.slug}`}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold truncate transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-500/30'
                          : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
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

            {/* Ders başlığı Hero kartı */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/60 to-indigo-50/30 p-6 sm:p-8 shadow-sm mb-8">
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                <div className="h-20 w-20 sm:h-22 sm:w-22 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-4xl sm:text-5xl shrink-0 shadow-lg shadow-indigo-500/25 ring-4 ring-white">
                  {lessonIcon || '📘'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/80 text-indigo-700 border border-indigo-200/60 text-xs font-black uppercase tracking-wider">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {gradeName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {academicYearLabel()}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight truncate">
                    {lessonName}
                  </h1>
                  <div className="flex items-center gap-3 mt-3 text-xs sm:text-sm font-bold text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-slate-700 bg-white/80 border border-slate-200/80 px-3 py-1 rounded-xl shadow-2xs">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      {units.length} Ünite
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-700 bg-white/80 border border-slate-200/80 px-3 py-1 rounded-xl shadow-2xs">
                      <BookOpen className="h-4 w-4 text-purple-600" />
                      {totalTopics} Konu
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ünite Kartları Listesi */}
            <div className="space-y-5">
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
                    className={`scroll-mt-4 rounded-2xl sm:rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${
                      isDraftUnit
                        ? 'border-amber-300/80 bg-amber-50/40'
                        : `bg-white ${accent.border}`
                    }`}
                  >
                    {/* Ünite Başlık Alanı */}
                    <div
                      className={`p-4 sm:p-6 flex items-center gap-4 border-b ${
                        isDraftUnit
                          ? 'border-amber-200/60 bg-gradient-to-r from-amber-100/60 via-amber-50/40 to-white'
                          : `border-slate-100 bg-gradient-to-r ${accent.lightGlow}`
                      }`}
                    >
                      <div
                        className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-black text-white shrink-0 ring-4 ring-white shadow-md ${
                          isDraftUnit ? 'bg-amber-500 shadow-amber-500/20' : accent.badge
                        }`}
                      >
                        {displayNo}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3
                          className={`text-base sm:text-xl font-black tracking-tight truncate ${
                            isDraftUnit ? 'text-amber-900' : 'text-slate-900'
                          }`}
                        >
                          {unit.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {isDraftUnit && (
                            <span className="rounded-full bg-amber-100 border border-amber-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800">
                              Taslak
                            </span>
                          )}
                          {start != null && end != null && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-white/80 border border-slate-200/70 px-2.5 py-0.5 rounded-full shadow-2xs">
                              <Calendar className="h-3.5 w-3.5 text-indigo-500" /> Hafta {start}&ndash;{end}
                            </span>
                          )}
                          <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${accent.chip}`}>
                            {topics.length} Konu
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Konular Listesi */}
                    {topics.length === 0 ? (
                      <div className="p-6 text-center">
                        <p className="text-xs font-bold text-slate-400">Bu ünite için henüz konu bulunamadı.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {topics.map((topic, idx) => (
                          <button
                            key={topic.id}
                            onClick={() => goToTopic(unit.slug, topic.slug, start ?? currentWeek)}
                            className="w-full flex items-center gap-3.5 px-4 sm:px-6 py-3.5 text-left hover:bg-slate-50/80 transition-all duration-200 group cursor-pointer"
                          >
                            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 px-2.5 py-1 rounded-lg shrink-0 transition-colors">
                              {displayNo}.{idx + 1}
                            </span>
                            <div className="min-w-0 flex-1 text-sm sm:text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                              {topic.title}
                            </div>
                            <div className="h-7 w-7 rounded-full bg-slate-100/80 group-hover:bg-indigo-600 flex items-center justify-center transition-all duration-200 shrink-0">
                              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-all group-hover:translate-x-0.5" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {units.length === 0 && (
                <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-200 shadow-xs">
                  <Sparkles className="h-10 w-10 text-indigo-400 mx-auto mb-3 opacity-60" />
                  <p className="text-sm font-bold text-slate-500">Bu ders için henüz ünite bulunamadı.</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 font-medium mt-8 text-center flex items-center justify-center gap-1.5">
              <span>Haftaların tarih aralıkları MEB takvimine göredir ve değişiklik gösterebilir.</span>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
