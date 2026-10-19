// Herkese açık yıllık plan sayfası verisi. Kaynak: outcome_weeks → outcomes (is_current) → topics →
// units → lessons/grades; tek gömülü PostgREST sorgusu, anonim istemciyle okunur. Bir konunun haftaları,
// o konunun güncel kazanımlarının [start_week, end_week] aralıklarının birleşimidir. Konu adresleri
// sitemap ile aynı kuralı kullanır (frozen_unit_slug varsa o, yoksa ünitenin slug'ı).
// Hiyerarşi: sınıf → ders → ünite → konu.
import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;
const SELECT =
  'start_week, end_week, outcomes!inner(is_current, topics!inner(id, title, slug, frozen_unit_slug, is_active, is_archived, units!inner(id, title, slug, order_no, is_active, grades!inner(name, slug, order_no, is_active), lessons!inner(name, slug, order_no, is_active))))';

interface Named {
  name: string;
  slug: string | null;
  order_no: number | null;
  is_active: boolean;
}

interface PlanRow {
  start_week: number;
  end_week: number;
  outcomes: {
    is_current: boolean;
    topics: {
      id: number;
      title: string;
      slug: string | null;
      frozen_unit_slug: string | null;
      is_active: boolean;
      is_archived: boolean;
      units: { id: number; title: string; slug: string | null; order_no: number | null; is_active: boolean; grades: Named; lessons: Named };
    };
  };
}

export interface WeekRange {
  start: number;
  end: number;
}

export interface PlanItem {
  id: number;
  /** Konunun ilk haftası. */
  week: number;
  /** Konunun son haftası (tek haftalıksa week ile aynı). */
  endWeek: number;
  /** Konunun kapsadığı hafta aralıkları; "bu hafta" kontrolü bunlara göre yapılır. */
  ranges: WeekRange[];
  title: string;
  href: string;
}

export interface PlanUnit {
  id: number;
  title: string;
  firstWeek: number;
  lastWeek: number;
  items: PlanItem[];
}

export interface PlanLesson {
  name: string;
  href: string;
  units: PlanUnit[];
  topicCount: number;
  firstWeek: number;
  lastWeek: number;
}

export interface PlanGrade {
  name: string;
  lessons: PlanLesson[];
}

async function fetchPlanRows(supabase: SupabaseClient): Promise<PlanRow[]> {
  const rows: PlanRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('outcome_weeks')
      .select(SELECT)
      .eq('outcomes.is_current', true)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data as unknown as PlanRow[] | null) ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

// Konu başına tek kayıt: kapsadığı tüm hafta aralıkları. Pasif/arşiv/slug'sız kayıtlar atlanır.
function topicsWithRanges(rows: PlanRow[]) {
  const byTopic = new Map<number, { row: PlanRow; ranges: WeekRange[] }>();
  for (const row of rows) {
    const t = row.outcomes.topics;
    const u = t.units;
    if (!t.is_active || t.is_archived || !t.slug || !u.is_active || !u.slug) continue;
    if (!u.grades.is_active || !u.lessons.is_active || !u.grades.slug || !u.lessons.slug) continue;
    const entry = byTopic.get(t.id) ?? { row, ranges: [] };
    entry.ranges.push({ start: row.start_week, end: row.end_week });
    byTopic.set(t.id, entry);
  }
  return [...byTopic.entries()].map(([id, { row, ranges }]) => ({ id, row, ranges }));
}

export async function getYillikPlan(supabase: SupabaseClient): Promise<{ grades: PlanGrade[]; maxWeek: number }> {
  const rows = await fetchPlanRows(supabase);
  const entries = topicsWithRanges(rows);

  type LessonAcc = { order: number; name: string; href: string; units: Map<number, PlanUnit & { order: number }>; topicCount: number };
  const grades = new Map<string, { order: number; name: string; lessons: Map<string, { order: number; lesson: LessonAcc }> }>();

  for (const { id, row, ranges } of entries) {
    const t = row.outcomes.topics;
    const u = t.units;
    const gradeSlug = u.grades.slug as string;
    const lessonSlug = u.lessons.slug as string;
    const unitSlug = t.frozen_unit_slug ?? (u.slug as string);
    const week = Math.min(...ranges.map((r) => r.start));
    const endWeek = Math.max(...ranges.map((r) => r.end));

    let grade = grades.get(gradeSlug);
    if (!grade) {
      grade = { order: u.grades.order_no ?? 0, name: u.grades.name, lessons: new Map() };
      grades.set(gradeSlug, grade);
    }
    let lessonEntry = grade.lessons.get(lessonSlug);
    if (!lessonEntry) {
      lessonEntry = {
        order: u.lessons.order_no ?? 0,
        lesson: { order: u.lessons.order_no ?? 0, name: u.lessons.name, href: `/${gradeSlug}/${lessonSlug}`, units: new Map(), topicCount: 0 },
      };
      grade.lessons.set(lessonSlug, lessonEntry);
    }
    const lesson = lessonEntry.lesson;
    let unit = lesson.units.get(u.id);
    if (!unit) {
      unit = { id: u.id, title: u.title, firstWeek: week, lastWeek: endWeek, items: [], order: u.order_no ?? 0 };
      lesson.units.set(u.id, unit);
    }
    unit.items.push({ id, week, endWeek, ranges, title: t.title, href: `/${gradeSlug}/${lessonSlug}/${unitSlug}/${t.slug}` });
    unit.firstWeek = Math.min(unit.firstWeek, week);
    unit.lastWeek = Math.max(unit.lastWeek, endWeek);
    lesson.topicCount += 1;
  }

  const result: PlanGrade[] = [...grades.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      name: g.name,
      lessons: [...g.lessons.values()]
        .sort((a, b) => a.order - b.order)
        .map(({ lesson }) => {
          // Üniteler müfredat haftasına göre dizilir (ünite numarası değil): konular haftaya göre gelsin diye.
          const units = [...lesson.units.values()].sort((a, b) => a.firstWeek - b.firstWeek || a.order - b.order);
          for (const unit of units) unit.items.sort((a, b) => a.week - b.week || a.title.localeCompare(b.title, 'tr'));
          return {
            name: lesson.name,
            href: lesson.href,
            topicCount: lesson.topicCount,
            firstWeek: Math.min(...units.map((x) => x.firstWeek)),
            lastWeek: Math.max(...units.map((x) => x.lastWeek)),
            units: units.map((u) => ({ id: u.id, title: u.title, firstWeek: u.firstWeek, lastWeek: u.lastWeek, items: u.items })),
          };
        }),
    }));

  const maxWeek = rows.reduce((max, r) => Math.max(max, r.end_week), 1);
  return { grades: result, maxWeek };
}
