'use client';

// Dersler (anasayfa v4 sade tasarım, 2026-10-02): başlık + sağda sınıf sekmeleri, altında tek
// beyaz kart içinde ince çizgilerle ayrılmış ders satırları. Satırın iki hedefi var — ders adı
// konu anlatımına, sağdaki soru sayısı soru bankasına (iç içe <a> geçersiz, iki ayrı link).
// Ders rengi sadece küçük ikon kutusunda (bkz. subjectStyle.ts).
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Grade } from '@/app/src/models/homeTypes';
import type { HomeGradeSection } from '@/app/src/lib/homeStats';
import { SubjectIcon } from './SubjectIcon';

export function GradeLessonPicker({
  grades,
  selectedGrade,
  section,
  onSelect,
  aside,
}: {
  grades: Grade[];
  selectedGrade: Grade;
  section: HomeGradeSection | undefined;
  onSelect: (gradeId: string) => void;
  /** Masaüstünde listenin sağında ("Okulda bu hafta"). */
  aside?: React.ReactNode;
}) {
  const lessons = section?.lessons ?? [];
  const gradeSlug = section?.gradeSlug ?? selectedGrade.slug;

  return (
    <section id="dersler" aria-labelledby="dersler-baslik" className="flex scroll-mt-24 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="dersler-baslik" className="text-2xl font-bold tracking-tight text-default">
            Dersler
          </h2>
          <p className="mt-1 text-muted-foreground">Konu anlatımı ve cevap anahtarlı sorular, ders ders.</p>
        </div>
        <div role="tablist" aria-label="Sınıflar" className="inline-flex gap-1 rounded-xl bg-surface-elevated p-1 text-sm font-medium">
          {grades.map((grade) => {
            const active = grade.id === selectedGrade.id;
            return (
              <button
                key={grade.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="dersler-listesi"
                onClick={() => onSelect(grade.id)}
                className={`min-h-10 whitespace-nowrap rounded-lg px-4 transition-colors ${
                  active ? 'bg-background text-default shadow-sm' : 'text-muted-foreground hover:text-default'
                }`}
              >
                {grade.level}. Sınıf
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid grid-cols-1 items-start gap-6 ${aside ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : ''}`}>
      <div id="dersler-listesi" role="tabpanel" className="rounded-[20px] border border-default bg-background px-4 sm:px-5">
        {lessons.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Bu sınıf için henüz içerik eklenmedi.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {lessons.map((lesson) => {
              const lessonPath = gradeSlug && lesson.slug ? `/${gradeSlug}/${lesson.slug}` : null;
              return (
                <li key={lesson.id} className="group flex items-center gap-3.5 py-3.5">
                  <SubjectIcon lessonName={lesson.name} />
                  {lessonPath ? (
                    <Link href={lessonPath} className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug text-default transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {lesson.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {lesson.unitCount} ünite · {lesson.topicCount} konu
                      </span>
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug text-default">{lesson.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {lesson.unitCount} ünite · {lesson.topicCount} konu
                      </span>
                    </span>
                  )}
                  {lessonPath && lesson.questionCount > 0 ? (
                    <Link
                      href={`/soru-bankasi${lessonPath}`}
                      aria-label={`${lesson.name} soru bankası, ${lesson.questionCount} soru`}
                      className="flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {lesson.questionCount} soru <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="shrink-0 px-2 text-sm text-muted-foreground">Sorular yakında</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {aside}
      </div>
    </section>
  );
}
