'use client';

// Öğretmen anasayfası "Derslerim" (2026-11-24 sadeleştirildi): iki ayrı kart ("Bu haftanın konuları" +
// "Ünite ve konular") yerine tek birleşik kart. Her sınıf satırında sol tarafta bu haftanın konusu (varsa),
// sağ tarafta o sınıfın tüm ünitelerine geçiş bağlantısı bulunur. Menüdeki "Dersler" öğretmende buraya iner (/#dersler).
import Link from 'next/link';
import useSWR from 'swr';
import { useState } from 'react';
import { ChevronRight, Pencil, X } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { TeacherLessonsEditor } from '@/app/src/components/teacher/TeacherLessonsEditor';
import type { ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import r from '@/app/src/components/robotic/robotic.module.css';

type GradeLink = { id: string; slug?: string; name: string };
type MyLesson = { id: number; name: string; slug: string; gradeIds: Set<string> };

export function TeacherLessonsQuick({
  grades,
  thisWeek,
}: {
  grades: GradeLink[];
  thisWeek: { week: number; byGradeId: Record<string, ThisWeekTopicItem[]> };
}) {
  const { user, supabase } = useAuth();
  const [editing, setEditing] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const { data: lessons, mutate } = useSWR<MyLesson[]>(
    user ? ['teacher-lesson-grades', user.id] : null,
    async () => {
      const { data: rows } = await supabase.from('teacher_lessons').select('lessons(id, name, slug)').eq('teacher_id', user!.id);
      const mine = ((rows as { lessons: { id: number; name: string; slug: string } | null }[] | null) || [])
        .map((row) => row.lessons)
        .filter((l): l is { id: number; name: string; slug: string } => l !== null)
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
      if (!mine.length) return [];
      const { data: units } = await supabase.from('units').select('grade_id, lesson_id').eq('is_active', true).in('lesson_id', mine.map((l) => l.id));
      const byLesson = new Map<number, Set<string>>();
      for (const u of (units as { grade_id: number; lesson_id: number }[] | null) || []) {
        const set = byLesson.get(u.lesson_id) ?? new Set<string>();
        set.add(String(u.grade_id));
        byLesson.set(u.lesson_id, set);
      }
      return mine.map((l) => ({ ...l, gradeIds: byLesson.get(l.id) ?? new Set<string>() }));
    },
    { revalidateOnFocus: false },
  );

  const active = lessons?.find((l) => l.id === activeId) ?? lessons?.[0] ?? null;
  const activeGrades = active ? grades.filter((g) => g.slug && active.gradeIds.has(g.id)) : [];

  return (
    <section id="dersler" aria-labelledby="dersler-baslik" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dersler-baslik" className={`text-xl font-bold text-default ${r.display}`}>Derslerim</h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ${r.btnGhost}`}
        >
          {editing ? <X className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
          {editing ? 'Kapat' : 'Düzenle'}
        </button>
      </div>

      {editing && (
        <div className={`rounded-[22px] p-5 ${r.panel}`}>
          <TeacherLessonsEditor
            onSaved={() => {
              void mutate();
              setEditing(false);
            }}
          />
        </div>
      )}

      {lessons === undefined ? (
        <div aria-busy="true" aria-label="Derslerin yükleniyor" className={`h-44 animate-pulse rounded-[22px] ${r.panel}`} />
      ) : !active ? (
        !editing && (
          <p className={`rounded-[22px] p-5 text-sm text-muted-foreground ${r.panel}`}>
            Henüz ders seçmedin.{' '}
            <button type="button" onClick={() => setEditing(true)} className={`font-semibold hover:underline ${r.accent}`}>
              Derslerini seç
            </button>
            ; bu haftanın konuları ve ders sayfaların burada toplansın.
          </p>
        )
      ) : (
        <>
          {lessons.length > 1 && (
            <div role="tablist" aria-label="Ders seç" className="flex flex-wrap gap-2">
              {lessons.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={l.id === active.id}
                  onClick={() => setActiveId(l.id)}
                  className={`min-h-10 rounded-xl px-3.5 text-sm font-semibold ${r.item} ${l.id === active.id ? r.navActive : 'text-muted-foreground'}`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}

          <div className={`rounded-[22px] p-5 ${r.panel}`}>
            <p className={r.label}>{active.name} · {thisWeek.week}. hafta</p>

            {activeGrades.length ? (
              <ul className={`mt-3 divide-y divide-[var(--border)] ${r.divider}`}>
                {activeGrades.map((g) => {
                  const topics = (thisWeek.byGradeId[g.id] ?? []).filter((t) => t.lessonId === active.id && t.href);
                  const lessonHref = `/${g.slug}/${active.slug}`;
                  return (
                    <li key={g.id} className="py-3.5 first:pt-1 last:pb-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.name}</span>
                        <Link
                          href={lessonHref}
                          className={`inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold hover:underline ${r.accent}`}
                        >
                          Üniteler
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>

                      {topics.length > 0 ? (
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {topics.map((t) => (
                            <li key={t.id}>
                              <Link
                                href={t.href!}
                                className="group flex items-center justify-between gap-2 rounded-lg py-1 text-sm font-semibold text-default transition-colors hover:text-[var(--accent)]"
                              >
                                <span className="min-w-0 leading-snug">{t.title}</span>
                                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground ${r.groupHoverAccent}`} aria-hidden="true" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">Bu hafta atanmış konu yok</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Bu dersin henüz içeriği yok.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
