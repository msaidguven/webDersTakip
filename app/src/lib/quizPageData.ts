// app/src/lib/quizPageData.ts
// Konu (kavrama-testi) ve ünite (unite-testi) test sayfalarının veri/oturum mantığı — hem
// gerçek (SEO'lu, doğrudan ziyaret edilebilen) sayfalar hem de panelden açılan modal
// (intercepting route) varyantları AYNI fonksiyonları kullanır. Bu, ikisi arasında resume/soru
// seçimi davranışının zamanla birbirinden sapmasını yapısal olarak engeller.

import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { planTopicTestQuestions, planUnitTestQuestions } from '@/app/src/lib/quizQuestions';
import { findResumableSession } from '@/app/src/lib/quizResume';

type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };
type UnitRow = { id: number; title: string; slug: string | null };
type TopicRow = { id: number; title: string; slug: string | null };

export const getTopicTestPageData = cache(async function getTopicTestPageData(
  gradeSlug: string,
  lessonSlug: string,
  unitSlug: string,
  topicSlug: string
) {
  const supabase = await createClient();

  const decodedGradeSlug = decodeURIComponent(gradeSlug || '').trim();
  const decodedLessonSlug = decodeURIComponent(lessonSlug || '').trim();
  const decodedUnitSlug = decodeURIComponent(unitSlug || '').trim();
  const decodedTopicSlug = decodeURIComponent(topicSlug || '').trim();

  const [{ data: gradeData }, { data: lessonData }] = await Promise.all([
    supabase.from('grades').select('id, name, slug').eq('slug', decodedGradeSlug).maybeSingle(),
    supabase.from('lessons').select('id, name, slug').eq('slug', decodedLessonSlug).maybeSingle(),
  ]);

  const grade = gradeData as GradeRow | null;
  const lesson = lessonData as LessonRow | null;
  if (!grade || !lesson) return null;

  const isAdmin = await isViewerAdmin(supabase);

  let unitQuery = supabase
    .from('units')
    .select('id, title, slug')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug);
  if (!isAdmin) unitQuery = unitQuery.eq('is_active', true);
  const { data: unitData } = await unitQuery.maybeSingle();
  const unit = unitData as UnitRow | null;
  if (!unit) return null;

  let topicQuery = supabase.from('topics').select('id, title, slug').eq('unit_id', unit.id).eq('slug', decodedTopicSlug);
  if (!isAdmin) topicQuery = topicQuery.eq('is_active', true);
  const { data: topicData } = await topicQuery.maybeSingle();
  const topic = topicData as TopicRow | null;
  if (!topic) return null;

  // Gerçek soru sayısı: questions.topic_id (section_id'si dolu ya da boş fark etmeksizin,
  // /api/topic-test-questions ile aynı ilişki).
  const { count: topicQuestionCount } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topic.id);
  const questionCount = topicQuestionCount ?? 0;

  if (!isAdmin && questionCount === 0) return null;

  return {
    gradeId: grade.id,
    lessonId: lesson.id,
    unitId: unit.id,
    topicId: topic.id,
    gradeName: grade.name,
    lessonName: lesson.name,
    unitTitle: unit.title,
    topicTitle: topic.title,
    questionCount,
    hasQuestions: questionCount > 0,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: unit.slug,
    topicSlug: topic.slug,
  };
});

export type TopicTestPageData = NonNullable<Awaited<ReturnType<typeof getTopicTestPageData>>>;

export function buildTopicPath(data: TopicTestPageData) {
  return `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

export function buildQuestionBankPath(data: TopicTestPageData) {
  return `/soru-bankasi/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

export async function loadTopicQuizState(data: TopicTestPageData) {
  let resumable = null;
  let userId: string | null = null;
  if (data.hasQuestions) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (user) resumable = await findResumableSession(supabase, user.id, data.unitId, data.topicId);
  }

  // Resume varsa (ya da hiç soru yoksa) tam liste tek seferde gelir — aşamalı yükleme sadece
  // yeni başlayan testlerde uygulanır, bkz. quizPageData.ts başındaki yorum ve QuizClient'taki
  // questionsFullyLoaded mantığı (resume'da çift test_sessions açılmasını önlemek için).
  if (resumable || !data.hasQuestions) {
    return { resumable, initialQuestions: resumable?.questions ?? [], remainingQuestionIds: [] as number[], allCaughtUp: false };
  }

  const plan = await planTopicTestQuestions(data.topicId, userId);
  const initialQuestions = plan.firstQuestion ? [plan.firstQuestion] : [];
  return { resumable: null, initialQuestions, remainingQuestionIds: plan.remainingQuestionIds, allCaughtUp: plan.allCaughtUp };
}

type UnitRowFull = {
  id: number;
  title: string;
  description: string | null;
  slug: string | null;
  lesson_id: number;
  grade_id: number;
};
type UnitTopicRow = { id: number; slug: string | null; order_no: number };

export const getUnitTestPageData = cache(async function getUnitTestPageData(gradeSlug: string, lessonSlug: string, unitSlug: string) {
  const supabase = await createClient();

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

  const isAdmin = await isViewerAdmin(supabase);

  const { data: lessonGradeData } = await supabase
    .from('lesson_grades')
    .select('is_active')
    .eq('lesson_id', lesson.id)
    .eq('grade_id', grade.id)
    .maybeSingle();

  if (!isAdmin && (lessonGradeData as { is_active: boolean } | null)?.is_active === false) {
    return null;
  }

  let unitQuery = supabase
    .from('units')
    .select('id, title, description, slug, lesson_id, grade_id')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug);
  if (!isAdmin) unitQuery = unitQuery.eq('is_active', true);
  const { data: unitData } = await unitQuery.maybeSingle();

  const unit = unitData as UnitRowFull | null;
  if (!unit) return null;

  const { data: topicData, count: topicCount } = await supabase
    .from('topics')
    .select('id, slug, order_no', { count: 'exact' })
    .eq('unit_id', unit.id)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const topicRows = (topicData as UnitTopicRow[] | null) || [];
  const firstTopic = topicRows.find((topic) => topic.slug) || null;
  const exitHref = firstTopic?.slug
    ? `/${grade.slug}/${lesson.slug}/${unit.slug}/${firstTopic.slug}`
    : `/${grade.slug}/${lesson.slug}`;

  // Ünite testi sayfası yalnızca gerçekten sorusu olan ünitelerde gösterilmeli;
  // units.question_count elle girilen bir alan olduğu için burada gerçek soru
  // sayısını doğrudan topics -> questions.topic_id ilişkisinden hesaplıyoruz.
  const topicIds = topicRows.map((t) => t.id);
  let realQuestionCount = 0;
  if (topicIds.length) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('topic_id', topicIds);
    realQuestionCount = count ?? 0;
  }

  if (!isAdmin && realQuestionCount === 0) return null;

  return {
    gradeId: grade.id,
    lessonId: lesson.id,
    unitId: unit.id,
    gradeName: grade.name,
    lessonName: lesson.name,
    unitTitle: unit.title,
    unitDescription: unit.description,
    questionCount: realQuestionCount,
    topicCount: topicCount ?? null,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: unit.slug,
    exitHref,
    hasQuestions: realQuestionCount > 0,
  };
});

export type UnitTestPageData = NonNullable<Awaited<ReturnType<typeof getUnitTestPageData>>>;

export async function loadUnitQuizState(data: UnitTestPageData) {
  let resumable = null;
  let userId: string | null = null;
  if (data.hasQuestions) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (user) resumable = await findResumableSession(supabase, user.id, data.unitId, null);
  }

  if (resumable || !data.hasQuestions) {
    return { resumable, initialQuestions: resumable?.questions ?? [], remainingQuestionIds: [] as number[], allCaughtUp: false };
  }

  const plan = await planUnitTestQuestions(data.unitId, userId);
  const initialQuestions = plan.firstQuestion ? [plan.firstQuestion] : [];
  return { resumable: null, initialQuestions, remainingQuestionIds: plan.remainingQuestionIds, allCaughtUp: plan.allCaughtUp };
}
