import type { SupabaseClient } from '@supabase/supabase-js';
import { getLessonColor } from './homeMapping';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// "Yayında" tanımı: is_active=true tek başına yetmez (admin taslak olarak oluşturup içini
// hiç doldurmamış olabilir, ya da satır artık aktif olmayan bir sınıfa ait olabilir).
// GERÇEK yayın sinyali topic_contents.is_published=true — bu sitenin asıl içeriği konu
// ANLATIMI (topic_contents), soru bankası değil: bir konunun hiç sorusu olmasa da yayınlanmış
// anlatımı varsa öğrenci onu okuyup çalışabilir, dolayısıyla "yayında" sayılır. (Soruyu da
// şart koşmak — ilk hatalı sürümün yaptığı gibi — Din Kültürü/Fen Bilimleri/Matematik gibi
// anlatımı hazır ama henüz soru bankası doldurulmamış gerçek dersleri yanlışlıkla gizliyordu.)
type UnitContentRow = {
  id: number;
  lesson_id: number;
  grade_id: number;
  hasPublishedContent: boolean;
  topicCount: number;
  questionCount: number;
};

async function getPublishedUnitContent(supabase: AnySupabaseClient, gradeIds: number[]): Promise<UnitContentRow[]> {
  if (!gradeIds.length) return [];

  const { data: unitRows } = await supabase
    .from('units')
    .select('id, lesson_id, grade_id')
    .in('grade_id', gradeIds)
    .eq('is_active', true);
  const units = (unitRows as { id: number; lesson_id: number; grade_id: number }[] | null) || [];
  if (!units.length) return [];

  const unitIds = units.map((u) => u.id);
  const { data: topicRows } = await supabase.from('topics').select('id, unit_id').in('unit_id', unitIds).eq('is_active', true);
  const topics = (topicRows as { id: number; unit_id: number }[] | null) || [];
  const topicIds = topics.map((t) => t.id);

  const [{ data: publishedContentRows }, { data: questionRows }] = await Promise.all([
    topicIds.length
      ? supabase.from('topic_contents').select('id, topic_id').in('topic_id', topicIds).eq('is_published', true)
      : Promise.resolve({ data: [] as { id: number; topic_id: number }[] }),
    topicIds.length
      ? supabase.from('questions').select('id, topic_id').in('topic_id', topicIds)
      : Promise.resolve({ data: [] as { id: number; topic_id: number | null }[] }),
  ]);

  const publishedTopicIds = new Set(((publishedContentRows as { id: number; topic_id: number }[] | null) || []).map((r) => r.topic_id));

  const questionCountByTopic = new Map<number, number>();
  for (const q of (questionRows as { id: number; topic_id: number | null }[] | null) || []) {
    if (q.topic_id == null) continue;
    questionCountByTopic.set(q.topic_id, (questionCountByTopic.get(q.topic_id) ?? 0) + 1);
  }

  const publishedTopicCountByUnit = new Map<number, number>();
  const questionCountByUnit = new Map<number, number>();
  for (const t of topics) {
    if (!publishedTopicIds.has(t.id)) continue;
    publishedTopicCountByUnit.set(t.unit_id, (publishedTopicCountByUnit.get(t.unit_id) ?? 0) + 1);
    questionCountByUnit.set(t.unit_id, (questionCountByUnit.get(t.unit_id) ?? 0) + (questionCountByTopic.get(t.id) ?? 0));
  }

  return units.map((u) => ({
    id: u.id,
    lesson_id: u.lesson_id,
    grade_id: u.grade_id,
    hasPublishedContent: (publishedTopicCountByUnit.get(u.id) ?? 0) > 0,
    topicCount: publishedTopicCountByUnit.get(u.id) ?? 0,
    questionCount: questionCountByUnit.get(u.id) ?? 0,
  }));
}

export interface SiteStats {
  gradeCount: number;
  lessonCount: number;
  unitCount: number;
  topicCount: number;
  questionCount: number;
  studentCount: number;
}

// Gerçek kayıtlı kullanıcı sayısı henüz küçük olduğu için anasayfada geçici olarak sabit,
// daha gerçekçi görünen bir sayı gösteriliyor (kullanıcı isteği, 2026-09-01). Sayı büyüdükçe
// bu sabiti kaldırıp aşağıdaki gerçek `profiles` sayımını (bkz. git geçmişi) geri koy.
const DISPLAYED_STUDENT_COUNT = 2388;

// Anasayfadaki istatistik çubuğu için gerçek, YAYINDA olan içerik sayıları (yukarıdaki not).
export async function getSiteStats(supabase: AnySupabaseClient): Promise<SiteStats> {
  const { data: gradeRows } = await supabase.from('grades').select('id').eq('is_active', true);

  const gradeIds = ((gradeRows as { id: number }[] | null) || []).map((g) => g.id);
  const publishedUnits = (await getPublishedUnitContent(supabase, gradeIds)).filter((u) => u.hasPublishedContent);

  const lessonKeys = new Set(publishedUnits.map((u) => `${u.grade_id}:${u.lesson_id}`));
  const topicCount = publishedUnits.reduce((sum, u) => sum + u.topicCount, 0);
  const questionCount = publishedUnits.reduce((sum, u) => sum + u.questionCount, 0);

  return {
    gradeCount: gradeIds.length,
    lessonCount: lessonKeys.size,
    unitCount: publishedUnits.length,
    topicCount,
    questionCount,
    studentCount: DISPLAYED_STUDENT_COUNT,
  };
}

export interface HomeLessonCard {
  id: string;
  name: string;
  icon: string;
  color: string;
  slug: string | null;
  unitCount: number;
  topicCount: number;
  questionCount: number;
}

export interface HomeGradeSection {
  gradeId: number;
  gradeSlug: string | null;
  lessons: HomeLessonCard[];
}

type LessonGradeRow = { lesson_id: number; grade_id: number; is_active: boolean };
type LessonRow = { id: number; name: string; icon: string | null; slug: string | null; order_no: number | null; is_active: boolean };

// Her aktif sınıf için, o sınıftaki derslerin GERÇEK (yayınlanmış anlatımı olan) ünite/konu/
// soru sayılarını tek seferde hesaplar — anasayfada sınıf sekmesi değiştiğinde ekstra istek
// atmadan anında geçiş yapabilmek için hepsini baştan getiriyoruz.
export async function getHomeGradeSections(
  supabase: AnySupabaseClient,
  grades: { id: number; slug: string | null }[]
): Promise<Map<number, HomeGradeSection>> {
  const gradeIds = grades.map((g) => g.id);
  if (!gradeIds.length) return new Map();

  const [{ data: lessonGradeRows }, publishedUnitsAll] = await Promise.all([
    supabase.from('lesson_grades').select('lesson_id, grade_id, is_active').in('grade_id', gradeIds),
    getPublishedUnitContent(supabase, gradeIds),
  ]);

  const publishedUnits = publishedUnitsAll.filter((u) => u.hasPublishedContent);

  // grade+lesson -> aggregate (yalnızca yayınlanmış anlatımı olan üniteler)
  type Agg = { unitCount: number; topicCount: number; questionCount: number };
  const aggByGradeLesson = new Map<string, Agg>();
  for (const u of publishedUnits) {
    const key = `${u.grade_id}:${u.lesson_id}`;
    const agg = aggByGradeLesson.get(key) ?? { unitCount: 0, topicCount: 0, questionCount: 0 };
    agg.unitCount += 1;
    agg.topicCount += u.topicCount;
    agg.questionCount += u.questionCount;
    aggByGradeLesson.set(key, agg);
  }

  // Bir ders, o sınıfta yayınlanmış sayılması için: lesson_grades.is_active VE en az bir
  // gerçek (yayınlanmış anlatımı olan) ünitesi olmalı.
  const activeLessonIdsByGrade = new Map<number, Set<number>>();
  for (const row of ((lessonGradeRows as LessonGradeRow[] | null) || [])) {
    if (!row.is_active) continue;
    if (!aggByGradeLesson.has(`${row.grade_id}:${row.lesson_id}`)) continue;
    const set = activeLessonIdsByGrade.get(row.grade_id) ?? new Set<number>();
    set.add(row.lesson_id);
    activeLessonIdsByGrade.set(row.grade_id, set);
  }

  const allLessonIds = Array.from(new Set(Array.from(activeLessonIdsByGrade.values()).flatMap((s) => Array.from(s))));
  const { data: lessonRows } = allLessonIds.length
    ? await supabase.from('lessons').select('id, name, icon, slug, order_no, is_active').in('id', allLessonIds).eq('is_active', true)
    : { data: [] as LessonRow[] };

  const lessonsById = new Map<number, LessonRow>();
  for (const l of (lessonRows as LessonRow[] | null) || []) lessonsById.set(l.id, l);

  const result = new Map<number, HomeGradeSection>();
  for (const grade of grades) {
    const lessonIds = Array.from(activeLessonIdsByGrade.get(grade.id) ?? []);
    const lessons: HomeLessonCard[] = lessonIds
      .map((lessonId) => lessonsById.get(lessonId))
      .filter((l): l is LessonRow => !!l)
      .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
      .map((lesson) => {
        const agg = aggByGradeLesson.get(`${grade.id}:${lesson.id}`) ?? { unitCount: 0, topicCount: 0, questionCount: 0 };
        return {
          id: String(lesson.id),
          name: lesson.name,
          icon: lesson.icon || '📘',
          color: getLessonColor(lesson.order_no ?? 0),
          slug: lesson.slug,
          unitCount: agg.unitCount,
          topicCount: agg.topicCount,
          questionCount: agg.questionCount,
        };
      });

    result.set(grade.id, { gradeId: grade.id, gradeSlug: grade.slug, lessons });
  }

  return result;
}

export interface WeeklyTopicItem {
  id: string;
  title: string;
  lessonName: string;
  href: string | null;
}

// "Haftanın Konuları" — gerçek müfredat haftası (units.start_week/end_week) her ünitede
// girilmiş değil, bu yüzden takvime dayalı bir seçim güvenilir değil (kullanıcı kararı,
// 2026-09-01). Bunun yerine dersin kendi içinden, sabit ama dersler arası çeşitlilik
// sağlayan basit bir formülle TEK bir temsilci konu seçiliyor:
//   x = dersin (yayınlanmış anlatımı olan) konu sayısı
//   index = round(36 / x), x'in içine sarılarak (36 haftalık bir yıla kabaca denk gelsin diye)
//   konular id'ye (eklenme sırasına) göre eskiden yeniye sıralanır, index'teki konu seçilir
// Her yayınlanmış ders için 1 konu döner (limit yok, ders sayısı kadar).
export async function getWeeklyTopicsForGrade(
  supabase: AnySupabaseClient,
  gradeId: number,
  gradeSlug: string | null
): Promise<WeeklyTopicItem[]> {
  const { data: unitRows } = await supabase
    .from('units')
    .select('id, slug, lesson_id, lessons(name, slug)')
    .eq('grade_id', gradeId)
    .eq('is_active', true);

  type UnitWithLesson = {
    id: number;
    slug: string | null;
    lesson_id: number;
    lessons: { name: string; slug: string | null } | { name: string; slug: string | null }[] | null;
  };
  const units = (unitRows as UnitWithLesson[] | null) || [];
  if (!units.length) return [];
  const unitById = new Map(units.map((u) => [u.id, u]));

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, title, slug, unit_id, topic_contents(id, is_published)')
    .in(
      'unit_id',
      units.map((u) => u.id)
    )
    .eq('is_active', true)
    .order('id', { ascending: true });

  type TopicWithContent = {
    id: number;
    title: string;
    slug: string | null;
    unit_id: number;
    topic_contents: { id: number; is_published: boolean }[] | null;
  };
  const publishedTopics = ((topicRows as TopicWithContent[] | null) || []).filter((t) =>
    (t.topic_contents ?? []).some((tc) => tc.is_published)
  );

  const topicsByLesson = new Map<number, TopicWithContent[]>();
  for (const topic of publishedTopics) {
    const unit = unitById.get(topic.unit_id);
    if (!unit) continue;
    const list = topicsByLesson.get(unit.lesson_id) ?? [];
    list.push(topic);
    topicsByLesson.set(unit.lesson_id, list);
  }

  const items: WeeklyTopicItem[] = [];
  for (const topics of topicsByLesson.values()) {
    const x = topics.length;
    if (x === 0) continue;
    const rawIndex = Math.round(36 / x) - 1; // 0-tabanlı
    const index = ((rawIndex % x) + x) % x; // x'in dışına taşarsa başa sar
    const topic = topics[index];
    const unit = unitById.get(topic.unit_id);
    const lessonRel = unit?.lessons;
    const lesson = Array.isArray(lessonRel) ? lessonRel[0] : lessonRel;
    const href =
      gradeSlug && lesson?.slug && unit?.slug && topic.slug ? `/${gradeSlug}/${lesson.slug}/${unit.slug}/${topic.slug}` : null;
    items.push({ id: String(topic.id), title: topic.title, lessonName: lesson?.name ?? '', href });
  }

  return items;
}
