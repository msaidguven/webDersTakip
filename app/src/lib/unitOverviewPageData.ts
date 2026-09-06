// app/src/lib/unitOverviewPageData.ts
// /[gradeSlug]/[lessonSlug]/[unitSlug] ünite tanıtım sayfasının veri katmanı (kullanıcının
// 2026-09-06 isteği: "ünite sayfası yok... ünite kapak resmi + konuların başlık/kapak
// görseli/kısa açıklaması olan bir sayfa yapalım"). Bilinçli olarak DersClient'ın devasa
// çalışma deneyimini (sidebar, hafta takvimi, aktif konu state'i) KULLANMIYOR — bu sadece
// "hangi konular var, hangisine gireyim" sorusuna cevap veren hafif, SEO'lu bir tanıtım
// sayfası (bkz. soruBankasiPageData.ts'teki getSoruBankasiUnitData ile aynı desen), konu
// kartları doğrudan gerçek konu sayfasına (DersClient) link veriyor.
import { cache } from 'react';
import { createAnonClient } from '@/utils/supabase/server-anon';

type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };

export const getUnitOverviewData = cache(async function getUnitOverviewData(gradeSlug: string, lessonSlug: string, unitSlug: string) {
  const supabase = createAnonClient();
  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();

  const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
    supabase.from('grades').select('id, name, slug').eq('slug', decodedGradeSlug).maybeSingle(),
    supabase.from('lessons').select('id, name, slug').eq('slug', decodedLessonSlug).maybeSingle(),
  ]);
  const grade = gradeData as GradeRow | null;
  const lesson = lessonData as LessonRow | null;
  if (!grade || !lesson) return null;

  const { data: unitData } = await supabase
    .from('units')
    .select('id, title, slug, description')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug)
    .eq('is_active', true)
    .maybeSingle();
  const unit = unitData as { id: number; title: string; slug: string | null; description: string | null } | null;
  if (!unit) return null;

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, title, slug, order_no')
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .order('order_no', { ascending: true });
  const topics = (topicRows as { id: number; title: string; slug: string | null; order_no: number | null }[] | null) || [];

  const topicIds = topics.map((t) => t.id);
  // Sadece YAYINDAKİ içerik gösteriliyor (bkz. lessonWeekData.ts'teki aynı is_published
  // filtresi) — içeriği olmayan konu, kartın kendisi yerine "İçerik eklenmemiş" olarak düşer.
  const { data: contentRows } = topicIds.length
    ? await supabase.from('topic_contents').select('topic_id, subtitle, hero_image_url').in('topic_id', topicIds).eq('is_published', true)
    : { data: [] as { topic_id: number; subtitle: string | null; hero_image_url: string | null }[] };
  const contentByTopic = new Map<number, { subtitle: string | null; hero_image_url: string | null }>();
  for (const row of (contentRows as { topic_id: number; subtitle: string | null; hero_image_url: string | null }[] | null) || []) {
    contentByTopic.set(row.topic_id, row);
  }

  const topicList = topics
    .filter((t) => t.slug)
    .map((t) => {
      const content = contentByTopic.get(t.id);
      return {
        id: t.id,
        title: t.title,
        slug: t.slug as string,
        subtitle: content?.subtitle ?? null,
        heroImageUrl: content?.hero_image_url ?? null,
        hasContent: !!content,
      };
    });

  // Ünite kapak görseli — ünitenin kendi görsel alanı yok, bu yüzden içindeki konulardan
  // (sırayla) görseli olan ilkini temsilci olarak kullanıyoruz (soru bankası ünite
  // sayfasındaki bannerImageUrl ile aynı fikir).
  const coverImageUrl = topicList.find((t) => t.heroImageUrl)?.heroImageUrl ?? null;

  // Üstteki Sınıf/Ders/Ünite/Konu hızlı değiştirici (kullanıcının 2026-09-06 isteği: "konu
  // sayfasındaki gibi bu sayfada da açılır menüler gösterilsin") — DersClient'taki AYNI
  // hiyerarşi barı görünümü ama farklı etkileşim: burada sayfa içi state DEĞİL, gerçek
  // navigasyon var (bkz. UnitHierarchyBar.tsx), o yüzden her seviye için sadece hafif bir
  // seçenek listesi yeterli.
  const [{ data: allGradesData }, { data: siblingLessonsRaw }, { data: siblingUnitsData }] = await Promise.all([
    supabase.from('grades').select('id, name, slug, order_no').eq('is_active', true).order('order_no', { ascending: true }),
    supabase
      .from('lesson_grades')
      .select('lesson_id, lessons(id, name, slug, icon, is_active)')
      .eq('grade_id', grade.id)
      .eq('is_active', true),
    supabase
      .from('units')
      .select('id, title, slug, order_no')
      .eq('lesson_id', lesson.id)
      .eq('grade_id', grade.id)
      .eq('is_active', true)
      .order('order_no', { ascending: true }),
  ]);

  const activeGradeRows = (allGradesData as { id: number; name: string; slug: string | null; order_no: number }[] | null) || [];
  const activeGradeIds = activeGradeRows.map((g) => g.id);
  const { data: gradeLessonRows } = activeGradeIds.length
    ? await supabase
        .from('lesson_grades')
        .select('grade_id, lesson_id, lessons(slug, name, is_active)')
        .in('grade_id', activeGradeIds)
        .eq('is_active', true)
    : { data: [] as { grade_id: number; lesson_id: number; lessons: { slug: string | null; name: string; is_active: boolean } | { slug: string | null; name: string; is_active: boolean }[] | null }[] };

  type GradeLessonRow = { grade_id: number; lesson_id: number; lessons: { slug: string | null; name: string; is_active: boolean } | { slug: string | null; name: string; is_active: boolean }[] | null };
  const lessonsByGrade = new Map<number, { lessonId: number; slug: string | null; name: string }[]>();
  for (const row of (gradeLessonRows as GradeLessonRow[] | null) || []) {
    const lessonRow = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons;
    if (!lessonRow || lessonRow.is_active === false || !lessonRow.slug) continue;
    const list = lessonsByGrade.get(row.grade_id) || [];
    list.push({ lessonId: row.lesson_id, slug: lessonRow.slug, name: lessonRow.name });
    lessonsByGrade.set(row.grade_id, list);
  }
  for (const list of lessonsByGrade.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  // Sınıf değiştirme — o sınıfta BU ders varsa aynı ders, yoksa o sınıfın ilk dersi (asla
  // ölü "Ders bulunamadı" ucuna düşülmesin diye, bkz. [lessonSlug]/page.tsx'teki aynı desen).
  const allGrades = activeGradeRows.map((g) => {
    const gradeLessonList = lessonsByGrade.get(g.id) || [];
    const sameLesson = gradeLessonList.find((l) => l.lessonId === lesson.id);
    const targetLessonSlug = sameLesson?.slug ?? gradeLessonList[0]?.slug ?? null;
    return { id: g.id, name: g.name, slug: g.slug || String(g.id), lessonSlug: targetLessonSlug };
  });

  type SiblingLessonRow = { lesson_id: number; lessons: { id: number; name: string; slug: string | null; icon: string | null; is_active: boolean } | { id: number; name: string; slug: string | null; icon: string | null; is_active: boolean }[] | null };
  const gradeLessons = ((siblingLessonsRaw as SiblingLessonRow[] | null) || [])
    .map((row) => (Array.isArray(row.lessons) ? row.lessons[0] : row.lessons))
    .filter((l): l is { id: number; name: string; slug: string | null; icon: string | null; is_active: boolean } => !!l && l.is_active !== false && !!l.slug)
    .map((l) => ({ id: l.id, name: l.name, slug: l.slug as string, icon: l.icon }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  const siblingUnits = ((siblingUnitsData as { id: number; title: string; slug: string | null; order_no: number | null }[] | null) || [])
    .filter((u) => u.slug)
    .map((u) => ({ id: u.id, title: u.title, slug: u.slug as string }));

  return {
    gradeId: grade.id,
    gradeName: grade.name,
    gradeSlug: grade.slug || decodedGradeSlug,
    lessonId: lesson.id,
    lessonName: lesson.name,
    lessonSlug: lesson.slug || decodedLessonSlug,
    unitId: unit.id,
    unitTitle: unit.title,
    unitSlug: unit.slug || decodedUnitSlug,
    unitDescription: unit.description,
    coverImageUrl,
    topics: topicList,
    allGrades,
    gradeLessons,
    siblingUnits,
  };
});

export type UnitOverviewData = NonNullable<Awaited<ReturnType<typeof getUnitOverviewData>>>;
