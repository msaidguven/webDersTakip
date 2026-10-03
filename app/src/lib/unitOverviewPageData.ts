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
import { resolvePublicGradeLesson } from '@/app/src/lib/publicGradeLesson';

export const getUnitOverviewData = cache(async function getUnitOverviewData(gradeSlug: string, lessonSlug: string, unitSlug: string) {
  const supabase = createAnonClient();
  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();

  // Kapalı ders/sınıf doğrudan URL ile de açılmasın (bkz. publicGradeLesson.ts).
  const resolved = await resolvePublicGradeLesson(supabase, decodedGradeSlug, decodedLessonSlug);
  if (!resolved) return null;
  const { grade, lesson } = resolved;

  // slug artık unique değil (aynı ders+sınıfta aynı isme/slug'a sahip iki farklı ünite
  // olabilir, bkz. supabase/migrations/units_slug_unique_per_lesson_grade.sql) — order+limit
  // ile ilk satırı deterministik olarak alıyoruz.
  const { data: unitRows } = await supabase
    .from('units')
    .select('id, title, slug, description')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug)
    .eq('is_active', true)
    .order('id', { ascending: true })
    .limit(1);
  const unit = (unitRows as { id: number; title: string; slug: string | null; description: string | null }[] | null)?.[0] || null;
  if (!unit) return null;

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, title, slug, order_no')
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .eq('is_archived', false)
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

  // Sağ sütundaki gezinme (2026-10-03; eskiden üstteki UnitHierarchyBar): sınıfın dersleri +
  // dersin üniteleri.
  const [{ data: siblingLessonsRaw }, { data: siblingUnitsData }] = await Promise.all([
    supabase
      .from('lesson_grades')
      .select('lesson_id, lessons(id, name, slug, icon, is_active, order_no)')
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

  type LessonCol = { id: number; name: string; slug: string | null; icon: string | null; is_active: boolean; order_no: number | null };
  type SiblingLessonRow = { lesson_id: number; lessons: LessonCol | LessonCol[] | null };
  // Ders sırası sitenin geri kalanıyla aynı (lessons.order_no), eşitlikte ada göre.
  const gradeLessons = ((siblingLessonsRaw as SiblingLessonRow[] | null) || [])
    .map((row) => (Array.isArray(row.lessons) ? row.lessons[0] : row.lessons))
    .filter((l): l is LessonCol => !!l && l.is_active !== false && !!l.slug)
    .sort((a, b) => (a.order_no ?? 999) - (b.order_no ?? 999) || a.name.localeCompare(b.name, 'tr'))
    .map((l) => ({ id: l.id, name: l.name, slug: l.slug as string, icon: l.icon }));

  // Kardeş ünitelerin gerçek konu sayısı (sorusu olmayanlar dahil) — sağ sütundaki ünite listesi için.
  const siblingRows = (siblingUnitsData as { id: number; title: string; slug: string | null; order_no: number | null }[] | null) || [];
  const { data: siblingTopicRows } = siblingRows.length
    ? await supabase.from('topics').select('unit_id').in('unit_id', siblingRows.map((u) => u.id)).eq('is_active', true).eq('is_archived', false)
    : { data: [] as { unit_id: number }[] };
  const topicCountByUnit = new Map<number, number>();
  for (const row of (siblingTopicRows as { unit_id: number }[] | null) || []) topicCountByUnit.set(row.unit_id, (topicCountByUnit.get(row.unit_id) ?? 0) + 1);
  const siblingUnits = siblingRows
    .filter((u) => u.slug)
    .map((u) => ({ id: u.id, title: u.title, slug: u.slug as string, topicCount: topicCountByUnit.get(u.id) ?? 0 }));

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
    gradeLessons,
    siblingUnits,
  };
});

export type UnitOverviewData = NonNullable<Awaited<ReturnType<typeof getUnitOverviewData>>>;
