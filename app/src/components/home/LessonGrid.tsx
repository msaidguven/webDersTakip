import Link from 'next/link';
import { BookOpen, ListChecks } from 'lucide-react';
import type { HomeGradeSection } from '@/app/src/lib/homeStats';
import type { Grade } from '@/app/src/models/homeTypes';

export function LessonGrid({ grade, section }: { grade: Grade; section: HomeGradeSection | undefined }) {
  const lessons = section?.lessons ?? [];
  const gradeSlug = section?.gradeSlug ?? grade.slug;

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-black text-default sm:text-xl">📘 {grade.name} Dersleri</h2>
          <p className="text-sm text-muted-foreground">{grade.name} müfredatındaki tüm derslere göz at.</p>
        </div>
        {gradeSlug && (
          <Link href={`/${gradeSlug}`} className="shrink-0 text-xs font-bold text-indigo-500 hover:text-indigo-600 sm:text-sm">
            Tüm Dersleri Gör →
          </Link>
        )}
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-default bg-surface-elevated p-6 text-center text-sm font-bold text-muted-foreground">
          Bu sınıf için henüz içerik eklenmedi.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {lessons.map((lesson) => {
            // Kartın tamamı link değil: içinde iki ayrı hedef var (iç içe <a> geçersiz HTML).
            const lessonPath = gradeSlug && lesson.slug ? `${gradeSlug}/${lesson.slug}` : null;
            const hasQuestions = lesson.questionCount > 0;
            return (
              <div key={lesson.id} className="flex flex-col rounded-2xl border border-default bg-surface-elevated p-4">
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${lesson.color} text-lg shadow-sm`}
                >
                  {lesson.icon}
                </div>
                <h3 className="mb-1 text-sm font-black text-default">{lesson.name}</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {lesson.unitCount} Ünite • {lesson.topicCount} Konu
                </p>
                <div className="mt-auto flex flex-col gap-2">
                  {lessonPath ? (
                    <Link
                      href={`/${lessonPath}`}
                      aria-label={`${lesson.name} konu anlatımı`}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-2 py-2 text-xs font-black text-white transition-colors hover:bg-indigo-600"
                    >
                      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Konu Anlatımı
                    </Link>
                  ) : (
                    <span aria-disabled="true" className="flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2 text-xs font-black text-muted-foreground">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Konu Anlatımı
                    </span>
                  )}
                  {lessonPath && hasQuestions ? (
                    <Link
                      href={`/soru-bankasi/${lessonPath}`}
                      aria-label={`${lesson.name} soru bankası, ${lesson.questionCount} soru`}
                      className="flex flex-col items-center rounded-xl border border-indigo-500/40 px-2 py-1.5 text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-400"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-black">
                        <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Soru Bankası
                      </span>
                      <span className="text-[11px] font-semibold opacity-80">{lesson.questionCount} soru</span>
                    </Link>
                  ) : (
                    // Henüz sorusu olmayan ders: buton görünür ama link yok (kullanıcı isteği, 2026-09-26).
                    <span
                      aria-disabled="true"
                      className="flex cursor-not-allowed flex-col items-center rounded-xl border border-default px-2 py-1.5 text-muted-foreground"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-black">
                        <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Soru Bankası
                      </span>
                      <span className="text-[11px] font-semibold">0 soru</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
