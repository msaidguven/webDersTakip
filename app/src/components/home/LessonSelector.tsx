//app/src/components/home/LessonSelector.tsx

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, BookOpen, CheckCircle2, Layers, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Grade, Lesson } from '../../models/homeTypes';

interface LessonSelectorProps {
  grade: Grade;
  lessons: Lesson[];
  isLoading: boolean;
  error?: string | null;
  onSelect: (lesson: Lesson) => void;
  onBack: () => void;
}

interface LessonUnit {
  id: number;
  title: string;
  slug: string | null;
  orderNo: number;
  isActive?: boolean;
  firstTopicSlug: string | null;
}

// Ünite sayfasına gitmeden, dersler sayfasındaki her dersin ünitelerini
// paralel olarak getirir; sonuç derse özel önbelleklenir, aynı ders için
// tekrar çağrılırsa yeniden ağ isteği yapılmaz. Birden fazla ders aynı anda
// yüklenebildiği için yükleme durumu ders id'sine göre bir küme olarak tutulur.
function useLessonUnits() {
  const [byLessonId, setByLessonId] = useState<Record<string, LessonUnit[]>>({});
  const [loadingLessonIds, setLoadingLessonIds] = useState<Set<string>>(new Set());

  const ensureLoaded = async (gradeId: string, lessonId: string) => {
    if (byLessonId[lessonId] || loadingLessonIds.has(lessonId)) return;
    setLoadingLessonIds((prev) => new Set(prev).add(lessonId));
    try {
      const params = new URLSearchParams({ gradeId, lessonId });
      const res = await fetch(`/api/lesson-units?${params.toString()}`);
      const data = res.ok ? await res.json().catch(() => null) : null;
      setByLessonId((prev) => ({ ...prev, [lessonId]: (data?.units as LessonUnit[]) || [] }));
    } finally {
      setLoadingLessonIds((prev) => {
        const next = new Set(prev);
        next.delete(lessonId);
        return next;
      });
    }
  };

  return { byLessonId, loadingLessonIds, ensureLoaded };
}

function GradeHeader({ grade, onBack }: { grade: Grade; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6 sm:mb-8">
      <button
        onClick={onBack}
        className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-xl bg-surface-elevated border border-default flex items-center justify-center text-muted-foreground hover:text-default hover:border-indigo-500/30 transition-all"
        aria-label="Sınıflara dön"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-muted-foreground min-w-0">
        <button onClick={onBack} className="hover:text-default transition-colors shrink-0">
          Anasayfa
        </button>
        <span className="shrink-0">/</span>
        <span className="inline-flex items-center gap-1.5 text-default truncate">
          <span className="text-base leading-none">{grade.icon}</span>
          {grade.name}
        </span>
      </nav>
    </div>
  );
}

const STAT_COLOR_CLASSES = {
  indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
} as const;

function HeroStat({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  color: keyof typeof STAT_COLOR_CLASSES;
}) {
  return (
    <div className="relative rounded-2xl border border-default bg-surface/70 backdrop-blur-sm p-3 sm:p-4 text-center sm:text-left">
      <div className={`inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-9 rounded-xl mb-1.5 sm:mb-2 ${STAT_COLOR_CLASSES[color]}`}>
        <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
      </div>
      <p className="text-xl sm:text-2xl font-black text-default leading-none">{value}</p>
      <p className="text-[10px] sm:text-xs font-bold text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function LessonCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-elevated border border-default p-4 sm:p-6 animate-pulse">
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-surface shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-5 sm:h-6 bg-surface rounded mb-2 w-24 sm:w-32" />
          <div className="h-3 sm:h-4 bg-surface rounded w-32 sm:w-48" />
        </div>
      </div>
    </div>
  );
}

export function LessonSelector({ grade, lessons, isLoading, error, onBack }: LessonSelectorProps) {
  const totalUnits = lessons.reduce((sum, l) => sum + (l.unitCount || 0), 0);
  const totalQuestions = lessons.reduce((sum, l) => sum + (l.questionCount || 0), 0);
  const { byLessonId, loadingLessonIds, ensureLoaded } = useLessonUnits();

  // Üniteler açılır pencere/tıklama beklemeden, sayfa açılır açılmaz her ders
  // için paralel olarak yüklenir.
  useEffect(() => {
    lessons.forEach((lesson) => {
      ensureLoaded(grade.id, lesson.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons, grade.id]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <GradeHeader grade={grade} onBack={onBack} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <LessonCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-0">
        <GradeHeader grade={grade} onBack={onBack} />
        <div className="text-center p-6 sm:p-8 rounded-2xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-500 font-bold mb-3 sm:mb-4 text-sm sm:text-base">Dersler yüklenirken bir hata oluştu</p>
          <p className="text-muted-foreground text-sm sm:text-base">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 sm:mt-6 px-5 sm:px-6 py-2.5 sm:py-3 bg-surface text-default border border-default rounded-xl hover:bg-surface-elevated transition-all text-sm sm:text-base font-bold"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      <GradeHeader grade={grade} onBack={onBack} />

      <div className="relative overflow-hidden rounded-3xl border border-default bg-surface-elevated mb-8 sm:mb-10">
        {/* İnce noktalı doku, sol üstten sağ alta doğru soluklaşarak */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
          style={{
            backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            color: 'rgb(99 102 241)',
            maskImage: 'radial-gradient(ellipse 70% 60% at 15% 10%, black 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 15% 10%, black 0%, transparent 70%)',
          }}
        />
        <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/25 via-purple-500/20 to-pink-500/10 blur-3xl" />
        <div
          className={`pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-gradient-to-br ${grade.color} opacity-10 blur-3xl`}
        />
        {/* Üstte ince, parlak bir vurgu çizgisi */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

        <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-6 sm:gap-8 p-6 sm:p-10">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-default bg-surface px-3 py-1.5 text-[11px] sm:text-xs font-bold text-muted-foreground mb-4">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
              {grade.icon} {grade.name} · Derslerini Seç
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-default mb-2.5 sm:mb-3 tracking-tight leading-tight">
              Hangi <span className="gradient-text">Derse</span> Çalışmak İstiyorsun?
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-lg mb-5 sm:mb-6">
              Dersini seç, ünitesini bul, konuyu aç — haftalık müfredata uygun sırayla ilerle.
            </p>

            {lessons.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-sm">
                <HeroStat icon={BookOpen} value={lessons.length} label="Ders" color="indigo" />
                <HeroStat icon={Layers} value={totalUnits} label="Ünite" color="amber" />
                <HeroStat icon={CheckCircle2} value={totalQuestions} label="Soru" color="emerald" />
              </div>
            )}
          </div>

          <div className="hidden lg:flex relative shrink-0 items-center justify-center h-44 w-44">
            <div
              className={`absolute inset-0 rounded-[2.5rem] bg-gradient-to-br ${grade.color} opacity-20 blur-2xl animate-pulse`}
              style={{ animationDuration: '4s' }}
            />
            <div
              className={`relative h-28 w-28 rounded-[2rem] bg-gradient-to-br ${grade.color} flex items-center justify-center text-5xl shadow-2xl animate-float-slow ring-4 ring-white/40 dark:ring-white/10`}
            >
              {grade.icon}
            </div>
            {lessons.slice(0, 4).map((lesson, i) => (
              <div
                key={lesson.id}
                className={`absolute h-10 w-10 rounded-xl bg-gradient-to-br ${lesson.color} flex items-center justify-center text-lg shadow-lg animate-float-slow ring-2 ring-white/50 dark:ring-white/10`}
                style={{
                  animationDelay: `${i * 0.6}s`,
                  top: i === 0 ? '-8px' : i === 1 ? '60%' : i === 3 ? '78%' : '6%',
                  left: i === 0 ? '72%' : i === 1 ? '-14px' : i === 3 ? '58%' : undefined,
                  right: i === 2 ? '-14px' : undefined,
                }}
              >
                {lesson.icon}
              </div>
            ))}
          </div>
        </div>
      </div>

      {lessons.length === 0 ? (
        <div className="text-center p-6 sm:p-8 rounded-2xl bg-surface-elevated border border-default">
          <p className="text-muted-foreground text-sm sm:text-base font-bold">Bu sınıf için henüz ders bulunmamaktadır.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-5">
            {lessons.map((lesson, index) => {
              const units = byLessonId[lesson.id];
              const isLoadingUnits = loadingLessonIds.has(lesson.id);

              return (
                <div
                  key={lesson.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-default/70 bg-surface-elevated shadow-sm animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-transparent"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  {/* Üst renk şeridi, dersin kendi rengiyle */}
                  <div className={`h-1.5 w-full shrink-0 bg-gradient-to-r ${lesson.color}`} />

                  <div className="relative overflow-hidden p-2.5 sm:p-6 pb-2.5 sm:pb-5">
                    {/* Kartın arkasında dersin rengiyle uyumlu yumuşak bir parıltı */}
                    <div
                      className={`pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${lesson.color} opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20`}
                    />

                    <div className="relative flex items-start gap-2 sm:gap-4">
                      <div className="relative shrink-0">
                        <div
                          className={`absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-br ${lesson.color} opacity-40 blur-lg transition-opacity duration-300 group-hover:opacity-70`}
                        />
                        <div
                          className={`relative w-9 h-9 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${lesson.color} flex items-center justify-center text-lg sm:text-3xl shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                        >
                          {lesson.icon}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 title={lesson.name} className="text-[13px] sm:text-lg font-black text-default leading-tight truncate">
                          {lesson.name}
                        </h3>
                        <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">{lesson.description}</p>
                      </div>
                    </div>

                    <div className="relative flex flex-wrap gap-1 sm:gap-2 mt-2 sm:mt-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-300">
                        <BookOpen className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                        {lesson.unitCount} Ünite
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {lesson.questionCount} Soru
                      </span>
                    </div>
                  </div>

                  <div className="relative flex-1 border-t border-default/70 bg-surface/40 p-1.5 sm:p-4">
                    {isLoadingUnits ? (
                      <div className="space-y-1.5 sm:space-y-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-9 sm:h-11 w-full rounded-lg sm:rounded-xl bg-surface animate-pulse" />
                        ))}
                      </div>
                    ) : !units || units.length === 0 ? (
                      <p className="text-center text-[10px] sm:text-sm text-muted-foreground py-3">
                        Bu derste henüz ünite bulunmuyor.
                      </p>
                    ) : (
                      <div className="space-y-1 sm:space-y-2">
                        {units.map((unit, unitIndex) => {
                          const isDraftUnit = unit.isActive === false;
                          return unit.firstTopicSlug && unit.slug ? (
                            <Link
                              key={unit.id}
                              href={`/${grade.slug || grade.id}/${lesson.slug || lesson.id}/${unit.slug}/${unit.firstTopicSlug}`}
                              className={`group/unit flex items-center gap-1.5 sm:gap-2.5 rounded-lg sm:rounded-xl border px-2 sm:px-3 py-1.5 sm:py-2.5 transition-all duration-200 hover:shadow-md animate-fade-in-up ${
                                isDraftUnit
                                  ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-500/10 hover:border-amber-400'
                                  : 'border-transparent bg-surface hover:border-default hover:bg-surface-elevated'
                              }`}
                              style={{ animationDelay: `${index * 70 + unitIndex * 40}ms` }}
                            >
                              <span
                                className={`h-5 w-5 sm:h-7 sm:w-7 shrink-0 rounded-full text-white flex items-center justify-center text-[9px] sm:text-[11px] font-black shadow-sm ${
                                  isDraftUnit ? 'bg-amber-500' : `bg-gradient-to-br ${lesson.color}`
                                }`}
                              >
                                {unitIndex + 1}
                              </span>
                              <span className={`flex-1 min-w-0 text-[11px] sm:text-sm font-bold truncate ${isDraftUnit ? 'text-amber-800 dark:text-amber-300' : 'text-default'}`}>{unit.title}</span>
                              {isDraftUnit && (
                                <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                  Taslak
                                </span>
                              )}
                              <ArrowRight className="hidden sm:block h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 group-hover/unit:translate-x-0.5 group-hover/unit:text-indigo-500" />
                            </Link>
                          ) : (
                            <div
                              key={unit.id}
                              className={`flex items-center gap-1.5 sm:gap-2.5 rounded-lg sm:rounded-xl border px-2 sm:px-3 py-1.5 sm:py-2.5 ${
                                isDraftUnit ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-500/10' : 'border-transparent bg-surface opacity-50'
                              }`}
                            >
                              <span className={`h-5 w-5 sm:h-7 sm:w-7 shrink-0 rounded-full flex items-center justify-center text-[9px] sm:text-[11px] font-black ${
                                isDraftUnit ? 'bg-amber-500 text-white' : 'bg-slate-500/10 text-slate-400'
                              }`}>
                                {unitIndex + 1}
                              </span>
                              <span className={`flex-1 min-w-0 text-[11px] sm:text-sm font-bold truncate ${isDraftUnit ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>{unit.title}</span>
                              {isDraftUnit ? (
                                <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/20 px-1.5 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                  Taslak
                                </span>
                              ) : (
                                <span className="hidden sm:inline text-[10px] text-muted-foreground shrink-0">Konu yok</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-8 sm:mt-10 overflow-hidden flex items-center justify-center gap-2.5 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 px-4 sm:px-6 py-3.5 sm:py-4 text-center">
            <div className="pointer-events-none absolute -top-8 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-2xl" />
            <Sparkles className="relative h-4 w-4 text-indigo-500 shrink-0" />
            <p className="relative text-xs sm:text-sm text-muted-foreground">
              <span className="font-black text-default">Unutma:</span> Her gün küçük bir adım, büyük bir değişimdir!
            </p>
          </div>
        </>
      )}
    </div>
  );
}
