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

  return {
    gradeName: grade.name,
    gradeSlug: grade.slug || decodedGradeSlug,
    lessonName: lesson.name,
    lessonSlug: lesson.slug || decodedLessonSlug,
    unitId: unit.id,
    unitTitle: unit.title,
    unitSlug: unit.slug || decodedUnitSlug,
    unitDescription: unit.description,
    coverImageUrl,
    topics: topicList,
  };
});

export type UnitOverviewData = NonNullable<Awaited<ReturnType<typeof getUnitOverviewData>>>;
