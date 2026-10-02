'use client';

// Dersler (anasayfa, 2026-10-02): başlık + sağda sınıf sekmeleri, altında ders kartları ızgarası. Satırın iki hedefi var — ders adı
// konu anlatımına, sağdaki soru sayısı soru bankasına (iç içe <a> geçersiz, iki ayrı link).
// Ders rengi sadece küçük ikon kutusunda (bkz. subjectStyle.ts).
import Link from 'next/link';
import type { Grade } from '@/app/src/models/homeTypes';
import type { HomeGradeSection } from '@/app/src/lib/homeStats';
import { SubjectIcon } from './SubjectIcon';
import { subjectStyle } from '@/app/src/lib/subjectStyle';

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
      <div id="dersler-listesi" role="tabpanel">
        {lessons.length === 0 ? (
          <p className="rounded-[20px] border border-default bg-background py-6 text-center text-sm text-muted-foreground">Bu sınıf için henüz içerik eklenmedi.</p>
        ) : (
          // Ders kartları (2026-10-02, kullanıcının beğendiği referans tasarım): dersin çok açık
          // renginde kart, dolgulu ikon; ad → konu anlatımı, soru sayısı → soru bankası.
          <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${aside ? '' : 'lg:grid-cols-3'}`}>
            {lessons.map((lesson) => {
              const lessonPath = gradeSlug && lesson.slug ? `/${gradeSlug}/${lesson.slug}` : null;
              return (
                <li
                  key={lesson.id}
                  className={`group flex items-center gap-3 rounded-2xl border p-3.5 transition-shadow sm:flex-col sm:items-stretch sm:p-4 hover:shadow-[0_10px_24px_-14px_rgba(16,16,40,0.3)] ${subjectStyle(lesson.name).tint}`}
                >
                  <SubjectIcon lessonName={lesson.name} variant="solid" size="lg" />
                  <div className="min-w-0 flex-1 sm:flex-none">
                    {lessonPath ? (
                      <Link href={lessonPath} className="block font-semibold leading-snug text-default transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                        {lesson.name}
                      </Link>
                    ) : (
                      <span className="block font-semibold leading-snug text-default">{lesson.name}</span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {lesson.unitCount} ünite · {lesson.topicCount} konu
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-2 text-sm sm:mt-auto">
                    {lessonPath ? (
                      <Link href={lessonPath} className="hidden font-medium text-muted-foreground hover:text-default sm:inline">
                        Konu anlatımı →
                      </Link>
                    ) : (
                      <span className="hidden sm:inline" />
                    )}
                    {lessonPath && lesson.questionCount > 0 ? (
                      <Link
                        href={`/soru-bankasi${lessonPath}`}
                        aria-label={`${lesson.name} soru bankası, ${lesson.questionCount} soru`}
                        className="inline-flex min-h-9 items-center whitespace-nowrap rounded-lg bg-background px-2.5 font-semibold text-default shadow-sm transition-colors hover:text-indigo-700 dark:hover:text-indigo-300"
                      >
                        {lesson.questionCount} soru
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Sorular yakında</span>
                    )}
                  </div>
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
