'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// /admin/konu-icerik/[topicId] sayfasında hızlıca başka bir konuya geçebilmek için —
// kullanıcının 2026-09-17 isteği: "solda hızlıca konuları seçebileceğim bi sidebar menü
// olsaydı iyi olurdu, sınıf/ders/ünite hiyerarşisi içinde". Sorgu deseni ContentAuditTab.tsx
// ile birebir aynı (client-side Supabase, RLS zaten admin'e bu tabloları okutuyor) — orada
// zaten kanıtlanmış bir yaklaşım, tekerleği yeniden icat etmeye gerek yoktu.
type GradeRow = { id: number; name: string; order_no: number };
type LessonRow = { id: number; name: string; order_no: number };
type LessonGradeRow = { lesson_id: number; grade_id: number; is_active: boolean };
type UnitRow = { id: number; lesson_id: number; grade_id: number; title: string; order_no: number };
type TopicRow = { id: number; unit_id: number; title: string; order_no: number };

type TopicNode = TopicRow;
type UnitNode = UnitRow & { topics: TopicNode[] };
type LessonNode = { lessonId: number; name: string; order_no: number; units: UnitNode[] };
type GradeNode = GradeRow & { lessons: LessonNode[] };

export default function TopicNavSidebar({ activeTopicId }: { activeTopicId: number }) {
  const [tree, setTree] = useState<GradeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  const [autoExpanded, setAutoExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [g, l, lg, u, t] = await Promise.all([
        supabase.from('grades').select('id, name, order_no').order('order_no'),
        supabase.from('lessons').select('id, name, order_no').order('order_no'),
        supabase.from('lesson_grades').select('lesson_id, grade_id, is_active').eq('is_active', true),
        supabase.from('units').select('id, lesson_id, grade_id, title, order_no').order('order_no'),
        supabase.from('topics').select('id, unit_id, title, order_no').order('order_no'),
      ]);
      if (cancelled) return;
      const firstError = [g, l, lg, u, t].find((r) => r.error)?.error;
      if (firstError) {
        setError(firstError.message);
        return;
      }

      const lessonById = new Map(((l.data as LessonRow[]) || []).map((row) => [row.id, row]));
      const topicsByUnit = new Map<number, TopicNode[]>();
      ((t.data as TopicRow[]) || []).forEach((topic) => {
        const arr = topicsByUnit.get(topic.unit_id) || [];
        arr.push(topic);
        topicsByUnit.set(topic.unit_id, arr);
      });
      const unitsByGradeLesson = new Map<string, UnitNode[]>();
      ((u.data as UnitRow[]) || []).forEach((unit) => {
        const key = `${unit.grade_id}-${unit.lesson_id}`;
        const arr = unitsByGradeLesson.get(key) || [];
        arr.push({ ...unit, topics: topicsByUnit.get(unit.id) || [] });
        unitsByGradeLesson.set(key, arr);
      });
      const lessonGradesByGrade = new Map<number, LessonGradeRow[]>();
      ((lg.data as LessonGradeRow[]) || []).forEach((row) => {
        const arr = lessonGradesByGrade.get(row.grade_id) || [];
        arr.push(row);
        lessonGradesByGrade.set(row.grade_id, arr);
      });

      const gradeNodes: GradeNode[] = ((g.data as GradeRow[]) || []).map((grade) => {
        const lessons: LessonNode[] = (lessonGradesByGrade.get(grade.id) || [])
          .map((row) => {
            const lesson = lessonById.get(row.lesson_id);
            return {
              lessonId: row.lesson_id,
              name: lesson?.name || `#${row.lesson_id}`,
              order_no: lesson?.order_no ?? 0,
              units: unitsByGradeLesson.get(`${grade.id}-${row.lesson_id}`) || [],
            };
          })
          .sort((a, b) => a.order_no - b.order_no);
        return { ...grade, lessons };
      });

      setTree(gradeNodes);
    })();
    return () => { cancelled = true; };
  }, []);

  // Aktif konunun bulunduğu sınıf/ders/ünite dalını otomatik açar — admin sayfayı ilk
  // açtığında nerede olduğunu göre göre, kapalı bir ağaçta arama yapmak zorunda kalmasın.
  useEffect(() => {
    if (!tree || autoExpanded) return;
    for (const grade of tree) {
      for (const lesson of grade.lessons) {
        for (const unit of lesson.units) {
          if (unit.topics.some((topic) => topic.id === activeTopicId)) {
            setExpandedGrades(new Set([grade.id]));
            setExpandedLessons(new Set([lesson.lessonId]));
            setExpandedUnits(new Set([unit.id]));
            setAutoExpanded(true);
            return;
          }
        }
      }
    }
    setAutoExpanded(true);
  }, [tree, activeTopicId, autoExpanded]);

  const toggle = (set: Set<number>, setter: (s: Set<number>) => void, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  const content = useMemo(() => {
    if (error) return <p className="p-3 text-xs font-bold text-[#ff6584]">{error}</p>;
    if (!tree) return <p className="p-3 text-xs text-muted-foreground">Yükleniyor...</p>;
    return (
      <ul className="space-y-0.5">
        {tree.map((grade) => (
          <li key={grade.id}>
            <button
              type="button"
              onClick={() => toggle(expandedGrades, setExpandedGrades, grade.id)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-black text-foreground hover:bg-accent transition-colors"
            >
              <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${expandedGrades.has(grade.id) ? 'rotate-90' : ''}`} />
              {grade.name}
            </button>
            {expandedGrades.has(grade.id) && (
              <ul className="ml-3 border-l border-border pl-2 space-y-0.5">
                {grade.lessons.map((lesson) => (
                  <li key={lesson.lessonId}>
                    <button
                      type="button"
                      onClick={() => toggle(expandedLessons, setExpandedLessons, lesson.lessonId)}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-bold text-foreground hover:bg-accent transition-colors"
                    >
                      <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${expandedLessons.has(lesson.lessonId) ? 'rotate-90' : ''}`} />
                      {lesson.name}
                    </button>
                    {expandedLessons.has(lesson.lessonId) && (
                      <ul className="ml-3 border-l border-border pl-2 space-y-0.5">
                        {lesson.units.map((unit) => (
                          <li key={unit.id}>
                            <button
                              type="button"
                              onClick={() => toggle(expandedUnits, setExpandedUnits, unit.id)}
                              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${expandedUnits.has(unit.id) ? 'rotate-90' : ''}`} />
                              {unit.title}
                            </button>
                            {expandedUnits.has(unit.id) && (
                              <ul className="ml-3 border-l border-border pl-2 space-y-0.5">
                                {unit.topics.map((topic) => (
                                  <li key={topic.id}>
                                    <Link
                                      href={`/admin/konu-icerik/${topic.id}`}
                                      className={`block truncate rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                                        topic.id === activeTopicId
                                          ? 'bg-[#6c63ff]/15 text-[#6c63ff]'
                                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                      }`}
                                      title={topic.title}
                                    >
                                      {topic.title}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    );
  }, [tree, error, expandedGrades, expandedLessons, expandedUnits, activeTopicId]);

  return (
    <nav className="w-[260px] shrink-0 border-r border-border bg-card overflow-y-auto h-full p-2">
      {content}
    </nav>
  );
}
