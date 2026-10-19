//app/src/components/home/LessonSelector.tsx

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, Layers, Sparkles, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Grade, Lesson } from '../../models/homeTypes';
import { buildSoruBankasiLessonPath } from '@/app/src/lib/soruBankasiPaths';

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

// Ortak sınıflar: çerçeve, nötr ikon kutusu (ikon bordo), bordo düğme. Ana sayfayla aynı dil.
const FRAME = 'rounded-2xl border border-[#7A2634]/20 bg-background';
const ICON_BOX = 'bg-zinc-100 text-[#7A2634]';
const BUTTON = 'bg-[#7A2634] text-white hover:bg-[#5C1B27]';

function Breadcrumb({ grade, onBack }: { grade: Grade; onBack: () => void }) {
  return (
    <nav aria-label="Konum" className="mb-4 flex items-center gap-1.5 text-xs font-bold text-muted-foreground sm:text-sm">
      <button onClick={onBack} className="transition-colors hover:text-[#7A2634]">
        Anasayfa
      </button>
      <span>/</span>
      <span className="inline-flex items-center gap-1.5 text-default">
        <span className="leading-none">{grade.icon}</span>
        {grade.name}
      </span>
    </nav>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#7A2634]/15 bg-surface/40 p-3">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ICON_BOX}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="text-lg font-black leading-none text-default">{value}</span>
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}

function LessonCardSkeleton() {
  return (
    <div className={`${FRAME} animate-pulse p-4 sm:p-6`}>
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-zinc-100 sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 h-5 w-24 rounded bg-zinc-100 sm:h-6 sm:w-32" />
          <div className="h-3 w-32 rounded bg-zinc-100 sm:h-4 sm:w-48" />
        </div>
      </div>
    </div>
  );
}

function UnitPanel({ grade, lesson, units, isLoadingUnits }: { grade: Grade; lesson: Lesson; units: LessonUnit[] | undefined; isLoadingUnits: boolean }) {
  return (
    <div className="p-1.5 sm:p-3">
                      {isLoadingUnits ? (
                        <div className="space-y-1.5 sm:space-y-2">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-zinc-200/70 sm:h-11 sm:rounded-xl" />
                          ))}
                        </div>
                      ) : !units || units.length === 0 ? (
                        <p className="py-3 text-center text-[10px] text-muted-foreground sm:text-sm">Bu derste henüz ünite bulunmuyor.</p>
                      ) : (
                        <div className="space-y-1 sm:space-y-2">
                          {units.map((unit, unitIndex) => {
                            const isDraftUnit = unit.isActive === false;
                            return unit.firstTopicSlug && unit.slug ? (
                              <Link
                                key={unit.id}
                                href={`/${grade.slug || grade.id}/${lesson.slug || lesson.id}/${unit.slug}/${unit.firstTopicSlug}`}
                                className={`group/unit flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2.5 ${
                                  isDraftUnit
                                    ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400 dark:bg-amber-500/10'
                                    : 'border-transparent bg-background hover:border-[#7A2634]/30 hover:bg-[#7A2634]/5'
                                }`}
                              >
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black sm:h-7 sm:w-7 sm:text-[11px] ${
                                    isDraftUnit ? 'bg-amber-500 text-white' : ICON_BOX
                                  }`}
                                >
                                  {unitIndex + 1}
                                </span>
                                <span className={`min-w-0 flex-1 truncate text-[11px] font-bold sm:text-sm ${isDraftUnit ? 'text-amber-800 dark:text-amber-300' : 'text-default'}`}>
                                  {unit.title}
                                </span>
                                {isDraftUnit && (
                                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-700 sm:text-[9px] dark:bg-amber-500/20 dark:text-amber-300">
                                    Taslak
                                  </span>
                                )}
                                <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover/unit:translate-x-0.5 group-hover/unit:text-[#7A2634] sm:block" />
                              </Link>
                            ) : (
                              <div
                                key={unit.id}
                                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-2.5 ${
                                  isDraftUnit ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-500/10' : 'border-transparent bg-background opacity-50'
                                }`}
                              >
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black sm:h-7 sm:w-7 sm:text-[11px] ${
                                    isDraftUnit ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-400'
                                  }`}
                                >
                                  {unitIndex + 1}
                                </span>
                                <span className={`min-w-0 flex-1 truncate text-[11px] font-bold sm:text-sm ${isDraftUnit ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
                                  {unit.title}
                                </span>
                                {isDraftUnit ? (
                                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-amber-700 sm:text-[9px] dark:bg-amber-500/20 dark:text-amber-300">
                                    Taslak
                                  </span>
                                ) : (
                                  <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">Konu yok</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
    </div>
  );
}

export function LessonSelector({ grade, lessons, isLoading, error, onBack }: LessonSelectorProps) {
  const totalUnits = lessons.reduce((sum, l) => sum + (l.unitCount || 0), 0);
  const totalQuestions = lessons.reduce((sum, l) => sum + (l.questionCount || 0), 0);
  const { byLessonId, loadingLessonIds, ensureLoaded } = useLessonUnits();
  // Ünitelər ayrı bir pencerede (modal) açılır; hangi ders açık olduğunu burada tutuyoruz.
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;
  useEffect(() => {
    if (!activeLesson) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveLessonId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeLesson]);

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
        <Breadcrumb grade={grade} onBack={onBack} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-4">
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
        <Breadcrumb grade={grade} onBack={onBack} />
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center sm:p-8">
          <p className="mb-3 text-sm font-bold text-red-500 sm:mb-4 sm:text-base">Dersler yüklenirken bir hata oluştu</p>
          <p className="text-sm text-muted-foreground sm:text-base">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 rounded-xl border border-default bg-surface px-5 py-2.5 text-sm font-bold text-default transition-all hover:bg-surface-elevated sm:mt-6 sm:px-6 sm:py-3 sm:text-base"
          >
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-0">
      <section className={`${FRAME} mb-6 flex flex-col gap-5 p-5 sm:mb-8 sm:p-7`}>
        <Breadcrumb grade={grade} onBack={onBack} />
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="mb-1.5 text-2xl font-black tracking-tight text-default sm:text-3xl">Bugün ne çalışıyorsun?</h1>
          <p className="max-w-md text-sm text-muted-foreground sm:text-base">Bir ders seç, ünitesini bul, konuyu aç.</p>
        </div>

        {lessons.length > 0 && (
          <div className="grid w-full grid-cols-3 gap-2 sm:gap-3 md:w-auto md:min-w-[340px]">
            <StatTile icon={BookOpen} value={lessons.length} label="Ders" />
            <StatTile icon={Layers} value={totalUnits} label="Ünite" />
            <StatTile icon={CheckCircle2} value={totalQuestions} label="Soru" />
          </div>
        )}
        </div>
      </section>

      {lessons.length === 0 ? (
        <div className={`${FRAME} p-6 text-center sm:p-8`}>
          <p className="text-sm font-bold text-muted-foreground sm:text-base">Bu sınıf için henüz ders bulunmamaktadır.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {lessons.map((lesson) => {
              const lessonPath = `/${grade.slug || grade.id}/${lesson.slug || lesson.id}`;

              return (
                <div key={lesson.id} className={`flex flex-col overflow-hidden ${FRAME} transition-colors hover:border-[#7A2634]/50`}>
                  <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-12 sm:w-12 sm:text-2xl ${ICON_BOX}`}>{lesson.icon}</div>
                      <h3 className="min-w-0 flex-1 truncate text-sm font-black leading-tight text-default sm:text-lg">
                        <Link href={lessonPath} title={lesson.name} className="hover:underline">
                          {lesson.name}
                        </Link>
                      </h3>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {lesson.unitCount} Ünite · {lesson.questionCount} Soru
                    </p>

                    <div className="grid grid-cols-1 gap-2">
                      <Link href={lessonPath} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${BUTTON}`}>
                        Konu anlatımı
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      {grade.slug && lesson.slug && lesson.questionCount > 0 && (
                        <Link
                          href={buildSoruBankasiLessonPath(grade.slug, lesson.slug)}
                          className="inline-flex items-center justify-center rounded-lg border border-[#7A2634]/30 px-3.5 py-2 text-xs font-bold text-[#7A2634] transition-colors hover:bg-[#7A2634]/5"
                        >
                          Soru bankası
                        </Link>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveLessonId(lesson.id)}
                    aria-haspopup="dialog"
                    className="w-full border-t border-[#7A2634]/15 px-4 py-2.5 text-left text-xs font-bold text-[#7A2634] transition-colors hover:bg-[#7A2634]/5 sm:text-sm"
                  >
                    Üniteleri göster ({lesson.unitCount})
                  </button>

                </div>
              );
            })}
          </div>

          {activeLesson && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setActiveLessonId(null)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="unite-pencere-baslik"
                className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#7A2634]/20 bg-background sm:max-w-xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-[#7A2634]/15 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-muted-foreground">{grade.name}</p>
                    <h2 id="unite-pencere-baslik" className="truncate text-lg font-black text-default">
                      {activeLesson.icon} {activeLesson.name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveLessonId(null)}
                    aria-label="Kapat"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#7A2634]/20 text-[#7A2634] transition-colors hover:bg-[#7A2634]/5"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="overflow-y-auto">
                  <UnitPanel grade={grade} lesson={activeLesson} units={byLessonId[activeLesson.id]} isLoadingUnits={loadingLessonIds.has(activeLesson.id)} />
                </div>
              </div>
            </div>
          )}

          <div className={`${FRAME} mt-8 flex items-center justify-center gap-2.5 px-4 py-3.5 text-center sm:mt-10 sm:px-6 sm:py-4`}>
            <Sparkles className="h-4 w-4 shrink-0 text-[#7A2634]" />
            <p className="text-xs text-muted-foreground sm:text-sm">
              <span className="font-black text-default">Unutma:</span> Her gün küçük bir adım, büyük bir değişimdir!
            </p>
          </div>
        </>
      )}
    </div>
  );
}
