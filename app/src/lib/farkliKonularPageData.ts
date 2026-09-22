// app/src/lib/farkliKonularPageData.ts
// /farkli-konular sayfasının veri katmanı — artık güncel müfredatta olmayan ama sayfası
// canlı/indekslenebilir kalan (bkz. topics.is_archived) konuları ders → ünite kırılımıyla
// listeler. Erişilebilir kalması gereken kayıtlarla TUTARLI olsun diye is_active=true şartı
// aynen konu detay sayfasındaki gibi uygulanıyor (bkz. [topicSlug]/page.tsx: is_archived tek
// başına yetmez, is_active de true olmalı — aksi halde konu zaten tamamen gizli).
import { cache } from 'react';
import { createAnonClient } from '@/utils/supabase/server-anon';

type TopicRow = { id: number; title: string; slug: string | null; unit_id: number };
type UnitRow = { id: number; title: string; slug: string | null; lesson_id: number; grade_id: number };
type LessonRow = { id: number; name: string; slug: string | null };
type GradeRow = { id: number; name: string; slug: string | null };

export type ArchivedTopicItem = {
  id: number;
  title: string;
  slug: string;
  path: string;
};

export type ArchivedUnitGroup = {
  id: number;
  title: string;
  topics: ArchivedTopicItem[];
};

export type ArchivedLessonGroup = {
  id: number;
  name: string;
  units: ArchivedUnitGroup[];
};

export type ArchivedGradeGroup = {
  id: number;
  name: string;
  lessons: ArchivedLessonGroup[];
};

export const getFarkliKonularData = cache(async function getFarkliKonularData(): Promise<ArchivedGradeGroup[]> {
  const supabase = createAnonClient();

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, title, slug, unit_id')
    .eq('is_active', true)
    .eq('is_archived', true)
    .order('order_no', { ascending: true });
  const topics = ((topicRows as TopicRow[] | null) || []).filter((t) => !!t.slug);
  if (!topics.length) return [];

  const unitIds = Array.from(new Set(topics.map((t) => t.unit_id)));
  const { data: unitRows } = await supabase
    .from('units')
    .select('id, title, slug, lesson_id, grade_id')
    .in('id', unitIds)
    .eq('is_active', true);
  const units = ((unitRows as UnitRow[] | null) || []).filter((u) => !!u.slug);
  const unitById = new Map(units.map((u) => [u.id, u]));
  if (!units.length) return [];

  const lessonIds = Array.from(new Set(units.map((u) => u.lesson_id)));
  const gradeIds = Array.from(new Set(units.map((u) => u.grade_id)));
  const [{ data: lessonRows }, { data: gradeRows }] = await Promise.all([
    supabase.from('lessons').select('id, name, slug').in('id', lessonIds).eq('is_active', true),
    supabase.from('grades').select('id, name, slug').in('id', gradeIds).eq('is_active', true),
  ]);
  const lessonById = new Map(((lessonRows as LessonRow[] | null) || []).filter((l) => !!l.slug).map((l) => [l.id, l]));
  const gradeById = new Map(((gradeRows as GradeRow[] | null) || []).filter((g) => !!g.slug).map((g) => [g.id, g]));

  // grade -> lesson -> unit hiyerarşisini kur, sonra içine konuları dağıt (topics zaten
  // order_no'ya göre sıralı geldiği için grup içi sıra da korunuyor).
  const gradeGroups = new Map<number, ArchivedGradeGroup>();
  for (const topic of topics) {
    const unit = unitById.get(topic.unit_id);
    if (!unit || !unit.slug) continue;
    const lesson = lessonById.get(unit.lesson_id);
    const grade = gradeById.get(unit.grade_id);
    if (!lesson || !lesson.slug || !grade || !grade.slug) continue;

    let gradeGroup = gradeGroups.get(grade.id);
    if (!gradeGroup) {
      gradeGroup = { id: grade.id, name: grade.name, lessons: [] };
      gradeGroups.set(grade.id, gradeGroup);
    }
    let lessonGroup = gradeGroup.lessons.find((l) => l.id === lesson.id);
    if (!lessonGroup) {
      lessonGroup = { id: lesson.id, name: lesson.name, units: [] };
      gradeGroup.lessons.push(lessonGroup);
    }
    let unitGroup = lessonGroup.units.find((u) => u.id === unit.id);
    if (!unitGroup) {
      unitGroup = { id: unit.id, title: unit.title, topics: [] };
      lessonGroup.units.push(unitGroup);
    }
    unitGroup.topics.push({
      id: topic.id,
      title: topic.title,
      slug: topic.slug as string,
      path: `/${grade.slug}/${lesson.slug}/${unit.slug}/${topic.slug}`,
    });
  }

  return Array.from(gradeGroups.values());
});
