// app/src/lib/soruBankasiPageData.ts
// /soru-bankasi altındaki 3 "hub" (listeleme) sayfasının veri katmanı:
// [sinif] → dersler, [sinif]/[ders] → üniteler, [sinif]/[ders]/[unite] → konular.
// Konu (kavrama testi) sayfalarının asıl veri/oturum mantığı quizPageData.ts'te — burası
// sadece SEO'lu listeleme/gezinme amaçlı, oturum/soru state'i taşımaz. Sorgu şekli
// bilerek app/[gradeSlug]/page.tsx ve app/[gradeSlug]/[lessonSlug]/page.tsx'teki mevcut
// desenle birebir aynı (grade/lesson/unit çözümleme, is_active filtreleme, admin-aware).

import { cache } from 'react';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { SITE_URL } from '@/app/src/lib/site';
import { getQuestionCountsByLessonGrade, getQuestionCountsByUnitId, getQuestionCountsByTopicId } from '@/app/src/lib/questionCounts';

type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };

export function buildSoruBankasiGradePath(gradeSlug: string) {
  return `/soru-bankasi/${gradeSlug}`;
}
export function buildSoruBankasiLessonPath(gradeSlug: string, lessonSlug: string) {
  return `/soru-bankasi/${gradeSlug}/${lessonSlug}`;
}
export function buildSoruBankasiUnitPath(gradeSlug: string, lessonSlug: string, unitSlug: string) {
  return `/soru-bankasi/${gradeSlug}/${lessonSlug}/${unitSlug}`;
}

export function buildSoruBankasiBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE_URL },
      ...items.map((item, i) => ({ '@type': 'ListItem', position: i + 2, name: item.name, item: `${SITE_URL}${item.path}` })),
    ],
  };
}

export const getSoruBankasiGradeData = cache(async function getSoruBankasiGradeData(gradeSlug: string) {
  const supabase = createAnonClient();
  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();

  const { data: gradeData } = await supabase.from('grades').select('id, name, slug').eq('slug', decodedGradeSlug).maybeSingle();
  const grade = gradeData as GradeRow | null;
  if (!grade) return null;

  const { data: lessonGradeRows } = await supabase.from('lesson_grades').select('lesson_id, is_active').eq('grade_id', grade.id);
  const lessonIds = ((lessonGradeRows as { lesson_id: number; is_active: boolean }[] | null) || [])
    .filter((row) => row.is_active)
    .map((row) => row.lesson_id);

  if (!lessonIds.length) {
    return { gradeName: grade.name, gradeSlug: grade.slug || decodedGradeSlug, lessons: [], hasQuestions: false };
  }

  const [{ data: lessonRows }, questionCountByLesson] = await Promise.all([
    supabase.from('lessons').select('id, name, slug, order_no').in('id', lessonIds).eq('is_active', true).order('order_no', { ascending: true }),
    getQuestionCountsByLessonGrade(supabase, lessonIds.map((lessonId) => ({ lessonId, gradeId: grade.id })), { activeOnly: true }),
  ]);

  const lessons = ((lessonRows as (LessonRow & { order_no: number | null })[] | null) || [])
    .filter((lesson) => lesson.slug)
    .map((lesson) => ({
      name: lesson.name,
      slug: lesson.slug as string,
      questionCount: questionCountByLesson.get(`${lesson.id}:${grade.id}`) ?? 0,
    }))
    .filter((lesson) => lesson.questionCount > 0);

  return {
    gradeName: grade.name,
    gradeSlug: grade.slug || decodedGradeSlug,
    lessons,
    hasQuestions: lessons.some((l) => l.questionCount > 0),
  };
});

export type SoruBankasiGradeData = NonNullable<Awaited<ReturnType<typeof getSoruBankasiGradeData>>>;

export const getSoruBankasiLessonData = cache(async function getSoruBankasiLessonData(gradeSlug: string, lessonSlug: string) {
  const supabase = createAnonClient();
  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();

  const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
    supabase.from('grades').select('id, name, slug').eq('slug', decodedGradeSlug).maybeSingle(),
    supabase.from('lessons').select('id, name, slug').eq('slug', decodedLessonSlug).maybeSingle(),
  ]);
  const grade = gradeData as GradeRow | null;
  const lesson = lessonData as LessonRow | null;
  if (!grade || !lesson) return null;

  const { data: lessonGradeData } = await supabase
    .from('lesson_grades')
    .select('is_active')
    .eq('lesson_id', lesson.id)
    .eq('grade_id', grade.id)
    .maybeSingle();
  if ((lessonGradeData as { is_active: boolean } | null)?.is_active === false) return null;

  const unitQuery = supabase
    .from('units')
    .select('id, title, slug, order_no')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('is_active', true);
  const { data: unitRows } = await unitQuery.order('order_no', { ascending: true });
  const units = (unitRows as { id: number; title: string; slug: string | null; order_no: number | null }[] | null) || [];

  const base = { gradeName: grade.name, gradeSlug: grade.slug || decodedGradeSlug, lessonName: lesson.name, lessonSlug: lesson.slug || decodedLessonSlug };
  if (!units.length) return { ...base, units: [], hasQuestions: false };

  const unitIds = units.map((u) => u.id);
  const [questionCountByUnit, { data: topicRows }] = await Promise.all([
    getQuestionCountsByUnitId(supabase, unitIds, { activeOnly: true }),
    supabase.from('topics').select('id, unit_id').in('unit_id', unitIds).eq('is_active', true),
  ]);
  const topicCountByUnit = new Map<number, number>();
  for (const t of (topicRows as { id: number; unit_id: number }[] | null) || []) {
    topicCountByUnit.set(t.unit_id, (topicCountByUnit.get(t.unit_id) ?? 0) + 1);
  }

  const unitList = units
    .filter((u) => u.slug)
    .map((u) => ({
      title: u.title,
      slug: u.slug as string,
      topicCount: topicCountByUnit.get(u.id) ?? 0,
      questionCount: questionCountByUnit.get(u.id) ?? 0,
    }))
    .filter((u) => u.questionCount > 0);

  return { ...base, units: unitList, hasQuestions: unitList.some((u) => u.questionCount > 0) };
});

export type SoruBankasiLessonData = NonNullable<Awaited<ReturnType<typeof getSoruBankasiLessonData>>>;

export const getSoruBankasiUnitData = cache(async function getSoruBankasiUnitData(gradeSlug: string, lessonSlug: string, unitSlug: string) {
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

  const unitQuery = supabase
    .from('units')
    .select('id, title, slug')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug)
    .eq('is_active', true);
  const { data: unitData } = await unitQuery.maybeSingle();
  const unit = unitData as { id: number; title: string; slug: string | null } | null;
  if (!unit) return null;

  const topicQuery = supabase.from('topics').select('id, title, slug, order_no').eq('unit_id', unit.id).eq('is_active', true);
  const { data: topicRows } = await topicQuery.order('order_no', { ascending: true });
  const topics = (topicRows as { id: number; title: string; slug: string | null; order_no: number | null }[] | null) || [];

  const base = {
    gradeId: grade.id,
    gradeName: grade.name,
    gradeSlug: grade.slug || decodedGradeSlug,
    lessonId: lesson.id,
    lessonName: lesson.name,
    lessonSlug: lesson.slug || decodedLessonSlug,
    unitId: unit.id,
    unitTitle: unit.title,
    unitSlug: unit.slug || decodedUnitSlug,
  };
  if (!topics.length) return { ...base, topics: [], bannerImageUrl: null, hasQuestions: false };

  // Konu görselleri (topic_contents.hero_image_url) — hem ünite banner'ı (ilk konunun
  // görseli) hem de "Konu Bazlı Analizler" listesindeki her konunun kendi küçük görseli
  // için (bkz. kullanıcının 2026-09-06 verdiği tasarım referansı).
  const [questionCountByTopic, { data: topicContentRows }] = await Promise.all([
    getQuestionCountsByTopicId(supabase, topics.map((t) => t.id), { activeOnly: true }),
    supabase.from('topic_contents').select('topic_id, hero_image_url').in('topic_id', topics.map((t) => t.id)),
  ]);
  const heroImageByTopic = new Map<number, string | null>();
  for (const row of (topicContentRows as { topic_id: number; hero_image_url: string | null }[] | null) || []) {
    heroImageByTopic.set(row.topic_id, row.hero_image_url);
  }

  const topicList = topics
    .filter((t) => t.slug)
    .map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug as string,
      questionCount: questionCountByTopic.get(t.id) ?? 0,
      heroImageUrl: heroImageByTopic.get(t.id) ?? null,
    }))
    .filter((t) => t.questionCount > 0);

  // topics zaten order_no'ya göre sıralı çekildi — ilk konu (sorusu olan) ünitenin banner'ı.
  const bannerImageUrl = topicList[0]?.heroImageUrl ?? null;

  return { ...base, topics: topicList, bannerImageUrl, hasQuestions: topicList.some((t) => t.questionCount > 0) };
});

export type SoruBankasiUnitData = NonNullable<Awaited<ReturnType<typeof getSoruBankasiUnitData>>>;
