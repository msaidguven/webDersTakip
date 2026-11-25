//app/src/components/home/LessonSelector.tsx

'use client';

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpenCheck, ChevronRight, FileText, Layers } from 'lucide-react';
import { Grade, Lesson } from '../../models/homeTypes';
import { buildSoruBankasiGradePath, buildSoruBankasiLessonPath } from '@/app/src/lib/soruBankasiPaths';
import { subjectStyle } from '@/app/src/lib/subjectStyle';
import r from '@/app/src/components/robotic/robotic.module.css';
import { GradeSwitcher } from '@/app/src/components/GradeSwitcher';
import { BottomSheet } from '@/app/src/components/ui/BottomSheet';
import { SubjectIcon } from '@/app/src/components/home/SubjectIcon';
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

// Ünite listesini yalnızca çekmece açıldığında (veya masaüstünde buton üzerine gelindiğinde)
// getirir; derse özel önbelleklenir, aynı ders için ikinci kez ağ isteği yapılmaz.
function useLessonUnits() {
  const [byLessonId, setByLessonId] = useState<Record<string, LessonUnit[]>>({});
  const [loadingLessonIds, setLoadingLessonIds] = useState<Set<string>>(new Set());

  const ensureLoaded = useCallback(async (gradeId: string, lessonId: string) => {
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
  }, [byLessonId, loadingLessonIds]);

  return { byLessonId, loadingLessonIds, ensureLoaded };
}

const FRAME = `rounded-[20px] sm:rounded-[22px] ${r.panel}`;
const CONTAINER = 'mx-auto max-w-6xl px-4 sm:px-6 2xl:max-w-[1440px]';

function Breadcrumb({ grade, onBack }: { grade: Grade; onBack: () => void }) {
  return (
    <nav aria-label="Konum" className={`hidden items-center gap-1.5 text-xs font-semibold sm:flex ${r.mono} ${r.muted}`}>
      <button type="button" onClick={onBack} className="transition-colors hover:text-cyan-600 dark:hover:text-cyan-400">
        Anasayfa
      </button>
      <span aria-hidden="true">/</span>
      <span className={r.accent}>{grade.name}</span>
    </nav>
  );
}

function LessonCardSkeleton() {
  return (
    <div className={`${FRAME} animate-pulse overflow-hidden`}>
      <div className="flex items-center gap-3.5 p-3.5 sm:p-5">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-500/15" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-slate-500/15 sm:h-5 sm:w-40" />
          <div className="h-3 w-24 rounded bg-slate-500/10" />
        </div>
      </div>
      <div className={`grid grid-cols-2 border-t ${r.divider}`}>
        <div className="h-10 bg-slate-500/5" />
        <div className={`h-10 border-l bg-slate-500/5 ${r.divider}`} />
      </div>
    </div>
  );
}

function UnitPanel({
  grade,
  lesson,
  units,
  isLoadingUnits,
}: {
  grade: Grade;
  lesson: Lesson;
  units: LessonUnit[] | undefined;
  isLoadingUnits: boolean;
}) {
  return (
    <div className="p-0.5 sm:p-1">
      {isLoadingUnits ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[52px] w-full animate-pulse rounded-2xl bg-slate-500/10" />
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
                className={`group/unit flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-all active:scale-[0.985] ${
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
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover/unit:translate-x-0.5 ${r.accent}`}
                  aria-hidden="true"
                />
              </Link>
            ) : (
              <div
                key={unit.id}
                className={`flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-2.5 ${
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
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;

  const openUnits = (lessonId: string) => {
    setActiveLessonId(lessonId);
    void ensureLoaded(grade.id, lessonId);
  };

  const totalUnits = lessons.reduce((sum, l) => sum + l.unitCount, 0);
  const totalQuestions = lessons.reduce((sum, l) => sum + l.questionCount, 0);

  if (isLoading) {
    return (
      <div className={CONTAINER}>
        <div className="mb-4 h-36 animate-pulse rounded-[20px] bg-slate-500/10 sm:mb-6 sm:h-44" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <LessonCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={CONTAINER}>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center sm:p-8">
          <p className="mb-2 text-sm font-bold text-red-500 sm:text-base">Dersler yüklenirken bir hata oluştu</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 rounded-xl border border-default bg-surface px-5 py-2.5 text-sm font-bold text-default transition-all hover:bg-surface-elevated active:scale-[0.98]"
          >
            Anasayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const activeLessonPath = activeLesson ? `/${grade.slug || grade.id}/${activeLesson.slug || activeLesson.id}` : null;
  const activeLessonBankPath =
    activeLesson && grade.slug && activeLesson.slug && activeLesson.questionCount > 0
      ? buildSoruBankasiLessonPath(grade.slug, activeLesson.slug)
      : null;
  const ActiveSubjectIcon = activeLesson ? subjectStyle(activeLesson.name).Icon : null;

  return (
    <div className={CONTAINER}>
      {/* Üst Başlık & Sınıf Seçici — mobilde kompakt uygulama kartı, masaüstünde kokpit başlığı */}
      <section className={`${FRAME} ${r.hero} mb-5 flex flex-col gap-3.5 p-4 sm:mb-7 sm:gap-5 sm:p-7`}>
        <span className={r.scan} aria-hidden="true" />
        <Breadcrumb grade={grade} onBack={onBack} />

        <div className="flex flex-col gap-3.5 md:flex-row md:items-end md:justify-between md:gap-6">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className={`inline-flex items-center gap-2 ${r.label}`}>
                <span className={r.led} aria-hidden="true" />
                MEB Müfredatı
              </p>
              {lessons.length > 0 && (
                <span className={`text-[11px] font-semibold sm:hidden ${r.mono} ${r.muted}`}>
                  {lessons.length} ders · {totalUnits} ünite
                </span>
              )}
            </div>

            <h1 className={`text-[22px] font-extrabold leading-tight sm:text-3xl ${r.chrome}`}>
              {grade.name} Dersleri
            </h1>
            <p className={`mt-1 text-[13px] leading-snug sm:text-base ${r.muted}`}>
              Dersini seç; konu anlatımı ve soru bankasıyla hemen çalış.
            </p>

            {lessons.length > 0 && (
              <ul className="mt-3 hidden flex-wrap gap-2 sm:flex" aria-label="Sınıf özeti">
                <li className={r.badge}>{lessons.length} ders</li>
                <li className={r.badge}>{totalUnits} ünite</li>
                {totalQuestions > 0 && (
                  <li className={r.badge}>{totalQuestions.toLocaleString('tr-TR')} soru</li>
                )}
              </ul>
            )}
          </div>

          <GradeSwitcher
            items={gradeLinks.map((g) => ({
              level: g.level,
              href: `/${g.slug}`,
              current: g.slug === grade.slug,
            }))}
          />
        </div>
      </section>

      {lessons.length === 0 ? (
        <div className={`${FRAME} p-6 text-center sm:p-8`}>
          <p className={`text-sm font-bold sm:text-base ${r.muted}`}>Bu sınıf için henüz ders bulunmamaktadır.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="sinif-dersleri-baslik">
            <div className="mb-2.5 flex items-baseline justify-between px-0.5 sm:mb-4">
              <h2 id="sinif-dersleri-baslik" className={`text-[15px] font-extrabold sm:text-lg ${r.ink}`}>
                Dersler
              </h2>
              <span className={`text-xs font-medium ${r.muted}`}>
                {totalQuestions > 0 ? `${totalQuestions.toLocaleString('tr-TR')} soru` : `${lessons.length} ders`}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {lessons.map((lesson) => {
                const lessonPath = `/${grade.slug || grade.id}/${lesson.slug || lesson.id}`;
                const hasQuestionBank = Boolean(grade.slug && lesson.slug && lesson.questionCount > 0);

                return (
                  <article
                    key={lesson.id}
                    className={`group flex flex-col ${FRAME} ${r.itemHover} transition-[border-color,box-shadow,transform] duration-200 sm:hover:-translate-y-0.5`}
                  >
                    {/* Ana dokunma alanı: doğrudan dersin konu anlatımı ve ünitelerine gider */}
                    <Link
                      href={lessonPath}
                      className="flex flex-1 items-center gap-3.5 rounded-t-[20px] p-3.5 transition-colors active:bg-slate-500/[0.06] sm:rounded-t-[22px] sm:p-5"
                    >
                      <SubjectIcon lessonName={lesson.name} variant="solid" size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className={`truncate text-[15px] font-extrabold leading-snug sm:text-base ${r.ink} ${r.groupHoverAccent}`}>
                          {lesson.name}
                        </h3>
                        <p className={`mt-0.5 truncate text-xs font-medium ${r.muted}`}>
                          {lesson.unitCount} ünite
                          {lesson.questionCount > 0 ? ` · ${lesson.questionCount.toLocaleString('tr-TR')} soru` : ''}
                        </p>
                      </div>
                      <ChevronRight
                        className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${r.muted} ${r.groupHoverAccent}`}
                        aria-hidden="true"
                      />
                    </Link>

                    {/* İnce alt aksiyon şeridi: Üniteler çekmecesi + Soru Bankası */}
                    <div
                      className={`grid overflow-hidden rounded-b-[20px] border-t sm:rounded-b-[22px] ${r.divider} ${
                        hasQuestionBank ? `grid-cols-2 divide-x ${r.divider}` : 'grid-cols-1'
                      }`}
                      style={{ background: 'color-mix(in srgb, var(--panel-solid) 65%, transparent)' }}
                    >
                      <button
                        type="button"
                        onClick={() => openUnits(lesson.id)}
                        onMouseEnter={() => void ensureLoaded(grade.id, lesson.id)}
                        onFocus={() => void ensureLoaded(grade.id, lesson.id)}
                        aria-haspopup="dialog"
                        className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 px-3 text-xs font-bold transition-colors hover:bg-cyan-500/10 active:scale-[0.98] ${r.accent}`}
                      >
                        <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Üniteler</span>
                        <span className="opacity-70">({lesson.unitCount})</span>
                      </button>

                      {hasQuestionBank && (
                        <Link
                          href={buildSoruBankasiLessonPath(grade.slug!, lesson.slug!)}
                          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 px-3 text-xs font-bold transition-colors hover:bg-cyan-500/10 active:scale-[0.98] ${r.ink} ${r.hoverAccent}`}
                        >
                          <BookOpenCheck className={`h-3.5 w-3.5 shrink-0 ${r.accent}`} aria-hidden="true" />
                          <span>Soru Bankası</span>
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Hızlı geçiş bölümü: Soru Bankası ve Yazılı Soruları */}
          <section aria-label="Hızlı geçiş" className="mt-5 sm:mt-8">
            <div className={`grid grid-cols-1 gap-2.5 sm:gap-4 ${totalQuestions > 0 && grade.slug ? 'sm:grid-cols-2' : ''}`}>
              {totalQuestions > 0 && grade.slug && (
                <Link
                  href={buildSoruBankasiGradePath(grade.slug)}
                  className={`group flex min-h-[64px] items-center gap-3.5 rounded-[20px] p-3.5 transition-all active:scale-[0.985] sm:p-4 ${r.item} ${r.itemHover}`}
                >
                  <span className={`h-10 w-10 shrink-0 rounded-xl ${r.chipBox}`} aria-hidden="true">
                    <BookOpenCheck className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-extrabold ${r.ink} ${r.groupHoverAccent}`}>
                      {grade.name} Soru Bankası
                    </span>
                    <span className={`block truncate text-xs ${r.muted}`}>
                      {totalQuestions.toLocaleString('tr-TR')} cevap anahtarlı soru ile pratik yap
                    </span>
                  </span>
                  <ChevronRight
                    className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${r.muted} ${r.groupHoverAccent}`}
                    aria-hidden="true"
                  />
                </Link>
              )}

              <Link
                href="/yazili-sorulari"
                className={`group flex min-h-[64px] items-center gap-3.5 rounded-[20px] p-3.5 transition-all active:scale-[0.985] sm:p-4 ${r.item} ${r.itemHover}`}
              >
                <span className={`h-10 w-10 shrink-0 rounded-xl ${r.chipBox}`} aria-hidden="true">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-extrabold ${r.ink} ${r.groupHoverAccent}`}>
                    Yazılı Soruları
                  </span>
                  <span className={`block truncate text-xs ${r.muted}`}>
                    Sınavlara özel çalışma kağıtları ve örnek yazılılar
                  </span>
                </span>
                <ChevronRight
                  className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${r.muted} ${r.groupHoverAccent}`}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </section>

          {/* Üniteler Çekmecesi (BottomSheet) */}
          <BottomSheet
            open={!!activeLesson}
            onClose={() => setActiveLessonId(null)}
            icon={ActiveSubjectIcon ? <ActiveSubjectIcon className="h-5 w-5" strokeWidth={2} /> : undefined}
            title={activeLesson?.name ?? ''}
            subtitle={
              activeLesson
                ? `${grade.name} · ${activeLesson.unitCount} ünite${
                    activeLesson.questionCount > 0 ? ` · ${activeLesson.questionCount.toLocaleString('tr-TR')} soru` : ''
                  }`
                : undefined
            }
            footer={
              activeLesson && activeLessonPath ? (
                <div className={`grid gap-2 ${activeLessonBankPath ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <Link
                    href={activeLessonPath}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold active:scale-[0.98] sm:text-sm ${r.btnNeon} ${r.btnText}`}
                  >
                    <span>Tüm konuları gör</span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </Link>
                  {activeLessonBankPath && (
                    <Link
                      href={activeLessonBankPath}
                      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold active:scale-[0.98] sm:text-sm ${r.btnGhost} ${r.btnText}`}
                    >
                      <BookOpenCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Soru Bankası</span>
                    </Link>
                  )}
                </div>
              ) : undefined
            }
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
        </>
      )}
    </div>
  );
}
