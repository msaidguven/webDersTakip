'use client';

// "Sınıfını seç" (2026-09-27 sade tasarım): sınıf sekmeleri + seçili sınıfın dersleri tek
// satırlık liste. Eski GradeTabs (büyük degrade kartlar) + LessonGrid (her derste iki büyük
// buton) yerine. Satırın iki hedefi var — ders adı konu anlatımına, sağdaki soru sayısı soru
// bankasına — iç içe <a> geçersiz HTML olduğu için satır bir kap, içinde iki ayrı link.
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';
import { SectionCard } from './SectionCard';
import type { Grade } from '@/app/src/models/homeTypes';
import type { HomeGradeSection } from '@/app/src/lib/homeStats';

export function GradeLessonPicker({
  grades,
  selectedGrade,
  section,
  onSelect,
}: {
  grades: Grade[];
  selectedGrade: Grade;
  section: HomeGradeSection | undefined;
  onSelect: (gradeId: string) => void;
}) {
  const lessons = section?.lessons ?? [];
  const gradeSlug = section?.gradeSlug ?? selectedGrade.slug;

  return (
    // Renkli bölüm kartı (2026-10-02); masaüstünde ekranın yarısında, "Okulda bu hafta"nın yanında.
    <SectionCard
      id="dersler"
      className="scroll-mt-24"
      tone="sky"
      headingId="dersler-baslik"
      icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
      title="Sınıfını seç"
      subtitle="Derse tıkla: konu anlatımı ve soru bankası tek yerde."
    >
      <div className="border-b border-default p-3">
        <div role="tablist" aria-label="Sınıflar" className="grid auto-cols-fr grid-flow-col gap-1.5 rounded-2xl bg-surface-elevated p-1.5">
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
                className={`min-h-11 rounded-xl px-4 text-sm font-bold transition-colors sm:text-[15px] ${
                  active ? 'bg-default text-default shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-muted-foreground hover:text-default'
                }`}
              >
                {grade.level}. Sınıf
              </button>
            );
          })}
        </div>
      </div>

      <div id="dersler-listesi" role="tabpanel">
        {lessons.length === 0 ? (
          <p className="p-6 text-center text-sm font-bold text-muted-foreground">Bu sınıf için henüz içerik eklenmedi.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {lessons.map((lesson) => {
              const lessonPath = gradeSlug && lesson.slug ? `/${gradeSlug}/${lesson.slug}` : null;
              return (
                <li key={lesson.id} className="flex items-center gap-4 px-4 py-4 sm:px-6">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl ${lesson.color}`}
                    aria-hidden="true"
                  >
                    {lesson.icon}
                  </span>
                  {lessonPath ? (
                    <Link href={lessonPath} className="group min-w-0 flex-1">
                      <span className="block text-base font-bold leading-snug text-default group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {lesson.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {lesson.unitCount} ünite · {lesson.topicCount} konu
                      </span>
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold leading-snug text-default">{lesson.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {lesson.unitCount} ünite · {lesson.topicCount} konu
                      </span>
                    </span>
                  )}
                  {lessonPath && lesson.questionCount > 0 ? (
                    <Link
                      href={`/soru-bankasi${lessonPath}`}
                      aria-label={`${lesson.name} soru bankası, ${lesson.questionCount} soru`}
                      className="flex shrink-0 items-center gap-1 rounded-xl px-2 py-2 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-400"
                    >
                      {lesson.questionCount} soru <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="shrink-0 px-2 text-sm font-semibold text-muted-foreground">Sorular yakında</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
