'use client';

// Öğretmen anasayfası "Derslerim" (2026-10-26 yeniden: önceki her sınıf×ders ayrı kutu düzeni 4 derste 11+14 kutuya
// çıkıyordu, kullanıcı "dağınık" buldu). Ders sekmeleri + seçili ders için yan yana İKİ ayrı kart, her kartın tek işi
// var (kullanıcı kuralı: iki farklı işlem aynı kartta olmasın): "Bu haftanın konuları" konuyu açar (anasayfanın
// "Okulda bu hafta" verisi, ek istek yok), "Ünite ve konular" o sınıfın ders sayfasını açar. Liste teacher_lessons;
// buradan düzenlenir (profildeki aynı seçici). Menüdeki "Dersler" öğretmende buraya iner (/#dersler).
import Link from 'next/link';
import useSWR from 'swr';
import { useState, type ReactNode } from 'react';
import { ChevronRight, Pencil, X } from 'lucide-react';
import { useAuth } from '@/app/src/context/AuthContext';
import { TeacherLessonsEditor } from '@/app/src/components/teacher/TeacherLessonsEditor';
import type { ThisWeekTopicItem } from '@/app/src/lib/homeHighlights';
import r from '@/app/src/components/robotic/robotic.module.css';

type GradeLink = { id: string; slug?: string; name: string };
type MyLesson = { id: number; name: string; slug: string; gradeIds: Set<string> };

// Öğretmen anasayfasındaki tüm listelerin ortak satırı: tek hedef, sağda ok.
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`group flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 ${r.item}`}>
      <span className="min-w-0">{children}</span>
      <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground ${r.groupHoverAccent}`} aria-hidden="true" />
    </Link>
  );
}

export function ListCard({ title, id, children, className = '' }: { title: string; id: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3 rounded-[22px] p-5 ${r.panel} ${className}`}>
      <h3 id={id} className={r.label}>{title}</h3>
      {children}
    </section>
  );
}

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
      // Dersin hangi sınıflarda olduğu: aktif ünitesi olan sınıflar (pasif sınıflar grades listesinde zaten yok).
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
  const weekTopics = active
    ? activeGrades.flatMap((g) => (thisWeek.byGradeId[g.id] ?? []).filter((t) => t.lessonId === active.id && t.href).map((t) => ({ topic: t, grade: g })))
    : [];

  return (
    <section id="dersler" aria-labelledby="dersler-baslik" className="flex scroll-mt-24 flex-col gap-4">
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
        <div aria-busy="true" aria-label="Derslerin yükleniyor" className={`h-48 animate-pulse rounded-[22px] ${r.panel}`} />
      ) : !active ? (
        !editing && (
          <p className={`rounded-[22px] p-5 text-sm text-muted-foreground ${r.panel}`}>
            Henüz ders seçmedin. <button type="button" onClick={() => setEditing(true)} className={`font-semibold hover:underline ${r.accent}`}>Derslerini seç</button>; bu haftanın konuları ve ders sayfaların burada toplansın.
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

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ListCard title={`Bu haftanın konuları · ${active.name}`} id="bu-hafta-baslik">
              {weekTopics.length ? (
                <ul className="flex flex-col gap-2">
                  {weekTopics.map(({ topic, grade }) => (
                    <li key={topic.id}>
                      <RowLink href={topic.href!}>
                        <span className="block text-xs font-semibold text-muted-foreground">{grade.name}</span>
                        <span className="block font-bold text-default">{topic.title}</span>
                      </RowLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{thisWeek.week}. hafta için bu derste atanmış konu yok.</p>
              )}
            </ListCard>

            <ListCard title="Ünite ve konular" id="unite-konular-baslik">
              {activeGrades.length ? (
                <ul className="flex flex-col gap-2">
                  {activeGrades.map((g) => (
                    <li key={g.id}>
                      <RowLink href={`/${g.slug}/${active.slug}`}>
                        <span className="block font-bold text-default">{g.name} {active.name}</span>
                      </RowLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Bu dersin henüz içeriği yok.</p>
              )}
            </ListCard>
          </div>
        </>
      )}
    </section>
  );
}
