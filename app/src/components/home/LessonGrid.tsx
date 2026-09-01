import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
            const href = gradeSlug && lesson.slug ? `/${gradeSlug}/${lesson.slug}` : null;
            const cardClassName = 'group flex flex-col rounded-2xl border border-default bg-surface-elevated p-4 card-hover';
            const content = (
              <>
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${lesson.color} text-lg shadow-sm`}
                >
                  {lesson.icon}
                </div>
                <h3 className="mb-1 text-sm font-black text-default">{lesson.name}</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  {lesson.unitCount} Ünite • {lesson.topicCount} Konu
                </p>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                  <div className="h-full w-0 rounded-full bg-indigo-500" />
                </div>
                <span className="mt-auto flex items-center gap-1 text-xs font-black text-indigo-500 group-hover:gap-1.5 transition-all">
                  Keşfet <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </>
            );
            return href ? (
              <Link key={lesson.id} href={href} className={cardClassName}>
                {content}
              </Link>
            ) : (
              <div key={lesson.id} className={cardClassName}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
