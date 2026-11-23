//app/src/components/home/LessonSelector.tsx

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Grade, Lesson } from '../../models/homeTypes';
import { buildSoruBankasiLessonPath } from '@/app/src/lib/soruBankasiPaths';
import r from '@/app/src/components/robotic/robotic.module.css';
import { GradeSwitcher } from '@/app/src/components/GradeSwitcher';
import { BottomSheet } from '@/app/src/components/ui/BottomSheet';
import { isClientAdmin } from '@/app/src/lib/clientSession';

export type GradeLink = { level: number; slug: string };

interface LessonSelectorProps {
  grade: Grade;
  lessons: Lesson[];
  // Başlıktaki sınıf sekmeleri (hızlı sınıf değiştirme, 2026-10-23).
  gradeLinks?: GradeLink[];
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
      // Admin dışındaki herkes aynı (yalnız yayındaki) listeyi görür → CDN'den gelir.
      if (!(await isClientAdmin())) params.set('publicOnly', '1');
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

// Görünüm: "robotik kontrol paneli" teması (2026-10-20, anasayfayla aynı; bkz. robotic). Kök tema
// sınıfı GradePageClient'ta.
const FRAME = `rounded-[22px] ${r.panel}`;
const BUTTON = `${r.btnNeon} ${r.btnText}`;
const GHOST = `${r.btnGhost} ${r.btnText}`;
// Sütun sayısı sabit kırılım noktalarına değil kart genişliğine bağlı: telefonda 1, tablette 2-3,
// masaüstünde 4, akıllı tahta / dev ekranda 5-6 sütun kendiliğinden oluşur (ad kesilmesin diye ≥17rem).
const GRID = 'grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]';
const CONTAINER = 'mx-auto max-w-6xl px-4 sm:px-6 2xl:max-w-[1600px]';


function Breadcrumb({ grade, onBack }: { grade: Grade; onBack: () => void }) {
  return (
    <nav aria-label="Konum" className={`mb-4 flex items-center gap-1.5 text-xs font-semibold ${r.mono} ${r.muted}`}>
      <button onClick={onBack} className="transition-colors hover:text-cyan-600 dark:hover:text-cyan-400">
        Anasayfa
      </button>
      <span>/</span>
      <span className={`inline-flex items-center gap-1.5 ${r.accent}`}>
        <span className="leading-none">{grade.icon}</span>
        {grade.name}
      </span>
    </nav>
  );
}

function LessonCardSkeleton() {
  return (
    <div className={`${FRAME} animate-pulse p-4 sm:p-6`}>
      <div className="flex items-center gap-4 sm:gap-5">
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-500/10 sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 h-5 w-24 rounded bg-slate-500/10 sm:h-6 sm:w-32" />
          <div className="h-3 w-32 rounded bg-slate-500/10 sm:h-4 sm:w-48" />
        </div>
      </div>
    </div>
  );
}

function UnitPanel({ grade, lesson, units, isLoadingUnits }: { grade: Grade; lesson: Lesson; units: LessonUnit[] | undefined; isLoadingUnits: boolean }) {
  return (
    <div className="p-0.5 sm:p-1">
      {isLoadingUnits ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-slate-500/10" />
          ))}
        </div>
      ) : !units || units.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Bu derste henüz ünite bulunmuyor.</p>
      ) : (
        <div className="space-y-2">
          {units.map((unit, unitIndex) => {
            const isDraftUnit = unit.isActive === false;
            return unit.firstTopicSlug && unit.slug ? (
              <Link
                key={unit.id}
                href={`/${grade.slug || grade.id}/${lesson.slug || lesson.id}/${unit.slug}/${unit.firstTopicSlug}`}
                className={`group/unit flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all active:scale-[0.99] ${
                  isDraftUnit
                    ? 'border-amber-300 bg-amber-50/60 hover:border-amber-400 dark:bg-amber-500/10'
                    : r.item
                }`}
              >
                <span
                  className={`h-8 w-8 shrink-0 text-xs ${
                    isDraftUnit ? 'flex items-center justify-center rounded-xl bg-amber-500 font-black text-white' : r.chipBox
                  }`}
                >
                  {String(unitIndex + 1).padStart(2, '0')}
                </span>
                <span className={`min-w-0 flex-1 text-sm font-bold leading-snug ${isDraftUnit ? 'text-amber-800 dark:text-amber-300' : r.ink}`}>
                  {unit.title}
                </span>
                {isDraftUnit && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    Taslak
                  </span>
                )}
                <ArrowRight className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover/unit:translate-x-0.5 ${r.accent}`} aria-hidden="true" />
              </Link>
            ) : (
              <div
                key={unit.id}
                className={`flex min-h-12 items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                  isDraftUnit ? 'border-amber-300 bg-amber-50/60 dark:bg-amber-500/10' : `${r.item} opacity-55`
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                    isDraftUnit ? 'bg-amber-500 text-white' : 'bg-slate-500/10 text-slate-400'
                  }`}
                >
                  {String(unitIndex + 1).padStart(2, '0')}
                </span>
                <span className={`min-w-0 flex-1 text-sm font-bold leading-snug ${isDraftUnit ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>
                  {unit.title}
                </span>
                {isDraftUnit ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                    Taslak
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">Yakında</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LessonSelector({ grade, lessons, gradeLinks = [], isLoading, error, onBack }: LessonSelectorProps) {
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
      <div className={CONTAINER}>
        <Breadcrumb grade={grade} onBack={onBack} />
        <div className={`grid gap-3 sm:gap-4 ${GRID}`}>
          {[1, 2, 3, 4].map((i) => (
            <LessonCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={CONTAINER}>
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
    <div className={CONTAINER}>
      <section className={`${FRAME} ${r.hero} mb-6 flex flex-col gap-5 p-5 sm:mb-8 sm:p-7`}>
        <span className={r.scan} aria-hidden="true" />
        <Breadcrumb grade={grade} onBack={onBack} />
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className={`mb-2 inline-flex items-center gap-2 ${r.label}`}><span className={r.led} aria-hidden="true" /> {grade.name} dersleri</p>
          <h1 className={`mb-1.5 text-2xl leading-tight sm:text-3xl ${r.chrome}`}>Bugün ne çalışıyorsun?</h1>
          <p className={`max-w-md text-sm sm:text-base ${r.muted}`}>Bir ders seç, ünitesini bul, konuyu aç.</p>
        </div>

        <GradeSwitcher items={gradeLinks.map((g) => ({ level: g.level, href: `/${g.slug}`, current: g.slug === grade.slug }))} />
        </div>
      </section>

      {lessons.length === 0 ? (
        <div className={`${FRAME} p-6 text-center sm:p-8`}>
          <p className={`text-sm font-bold sm:text-base ${r.muted}`}>Bu sınıf için henüz ders bulunmamaktadır.</p>
        </div>
      ) : (
        <>
          <div className={`grid gap-3 sm:gap-5 ${GRID}`}>
            {lessons.map((lesson) => {
              const lessonPath = `/${grade.slug || grade.id}/${lesson.slug || lesson.id}`;

              return (
                <div key={lesson.id} className={`group flex flex-col ${FRAME} ${r.itemHover} transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5`}>
                  <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 shrink-0 text-xl sm:h-12 sm:w-12 sm:text-2xl ${r.chipBox}`}>{lesson.icon}</div>
                      <h3 className={`min-w-0 flex-1 text-balance text-sm font-bold leading-tight sm:text-lg ${r.display} ${r.ink}`}>
                        <Link href={lessonPath} title={lesson.name} className="hover:underline">
                          {lesson.name}
                        </Link>
                      </h3>
                    </div>

                    <p className={`text-xs ${r.mono} ${r.muted}`}>
                      {lesson.unitCount} ünite{lesson.questionCount > 0 ? ` · ${lesson.questionCount} soru` : ''}
                    </p>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                      <Link href={lessonPath} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors active:scale-[0.98] ${BUTTON}`}>
                        Konu anlatımı
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                      {grade.slug && lesson.slug && lesson.questionCount > 0 && (
                        <Link
                          href={buildSoruBankasiLessonPath(grade.slug, lesson.slug)}
                          className={`inline-flex min-h-10 items-center justify-center rounded-xl px-3.5 py-2 text-xs font-bold active:scale-[0.98] ${GHOST}`}
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
                    className={`min-h-11 w-full rounded-b-[20px] border-t px-4 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-cyan-500/10 active:scale-[0.99] sm:rounded-b-[22px] ${r.mono} ${r.divider} ${r.accent}`}
                  >
                    Üniteleri göster ({lesson.unitCount})
                  </button>

                </div>
              );
            })}
          </div>

          <BottomSheet
            open={!!activeLesson}
            onClose={() => setActiveLessonId(null)}
            title={activeLesson ? `${activeLesson.icon} ${activeLesson.name}` : ''}
            subtitle={activeLesson ? `${grade.name} · ${activeLesson.unitCount} ünite${activeLesson.questionCount > 0 ? ` · ${activeLesson.questionCount} soru` : ''}` : undefined}
          >
            {activeLesson && (
              <UnitPanel
                grade={grade}
                lesson={activeLesson}
                units={byLessonId[activeLesson.id]}
                isLoadingUnits={loadingLessonIds.has(activeLesson.id)}
              />
            )}
          </BottomSheet>

          <div className={`${FRAME} mt-8 flex items-center justify-center gap-2.5 px-4 py-3.5 text-center sm:mt-10 sm:px-6 sm:py-4`}>
            <Sparkles className={`h-4 w-4 shrink-0 ${r.accent}`} />
            <p className={`text-xs sm:text-sm ${r.muted}`}>
              <span className={`font-bold ${r.ink}`}>Unutma:</span> Her gün küçük bir adım, büyük bir değişimdir!
            </p>
          </div>
        </>
      )}
    </div>
  );
}
