// app/src/lib/quizPageData.ts
// Konu (kavrama-testi) ve ünite (unite-testi) test sayfalarının veri/oturum mantığı — hem
// gerçek (SEO'lu, doğrudan ziyaret edilebilen) sayfalar hem de panelden açılan modal
// (intercepting route) varyantları AYNI fonksiyonları kullanır. Bu, ikisi arasında resume/soru
// seçimi davranışının zamanla birbirinden sapmasını yapısal olarak engeller.

import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { isViewerAdmin } from '@/app/src/lib/publishGuard';
import { planTopicTestQuestions, planUnitTestQuestions, type QuizQuestion } from '@/app/src/lib/quizQuestions';
import { findResumableSession, findConflictingSession } from '@/app/src/lib/quizResume';

type GradeRow = { id: number; name: string; slug: string | null };
type LessonRow = { id: number; name: string; slug: string | null };
type UnitRow = { id: number; title: string; slug: string | null };
type TopicRow = { id: number; title: string; slug: string | null };

// Not: admin/taslak dallanması yok — bu fonksiyon bilerek her zaman public (is_active +
// soru>0) filtreler. Konu/ders/sınıf/soru-bankası sayfaları ISR ile cache'lenebilsin diye
// (bkz. [gradeSlug]/[lessonSlug]/[unitSlug]/[topicSlug]/page.tsx'teki aynı desen). Taslak
// önizleme /ders?... + admin paneli üzerinden yapılıyor. Kavrama-testi/ünite-testi
// sayfaları bu fonksiyonu paylaşıyor ama zaten loadTopicQuizState/loadUnitQuizState'in
// oturum ihtiyacı yüzünden dinamik kalıyorlar — buradaki değişiklik onları cache'lemez,
// sadece admin'in oradan da taslak önizlemesini kaldırır.
export const getTopicTestPageData = cache(async function getTopicTestPageData(
  gradeSlug: string,
  lessonSlug: string,
  unitSlug: string,
  topicSlug: string
) {
  const supabase = createAnonClient();

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

  const unitQuery = supabase
    .from('units')
    .select('id, title, slug')
    .eq('grade_id', grade.id)
    .eq('lesson_id', lesson.id)
    .eq('slug', decodedUnitSlug)
    .eq('is_active', true);
  const { data: unitData } = await unitQuery.maybeSingle();
  const unit = unitData as UnitRow | null;
  if (!unit) return null;

  const topicQuery = supabase
    .from('topics')
    .select('id, title, slug')
    .eq('unit_id', unit.id)
    .eq('slug', decodedTopicSlug)
    .eq('is_active', true);
  const { data: topicData } = await topicQuery.maybeSingle();
  const topic = topicData as TopicRow | null;
  if (!topic) return null;

  // Gerçek soru sayısı: questions.topic_id (section_id'si dolu ya da boş fark etmeksizin,
  // /api/topic-test-questions ile aynı ilişki). Kapak görseli (topic_contents.hero_image_url)
  // ile birlikte — konu sayfası (DersClient) için zaten üretilmiş görsel, soru bankası
  // sayfasında da banner olarak kullanılıyor (bkz. kullanıcının 2026-09-06 isteği: "konu
  // kapak resmi db de vardı").
  const [{ count: topicQuestionCount }, { data: topicContentData }] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('topic_id', topic.id).eq('is_active', true),
    supabase.from('topic_contents').select('hero_image_url').eq('topic_id', topic.id).maybeSingle(),
  ]);
  const questionCount = topicQuestionCount ?? 0;

  if (questionCount === 0) return null;

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
    heroImageUrl: (topicContentData as { hero_image_url: string | null } | null)?.hero_image_url ?? null,
  };
});

export type TopicTestPageData = NonNullable<Awaited<ReturnType<typeof getTopicTestPageData>>>;

export function buildTopicPath(data: TopicTestPageData) {
  return `/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

export function buildQuestionBankPath(data: TopicTestPageData) {
  return `/soru-bankasi/${data.gradeSlug}/${data.lessonSlug}/${data.unitSlug}/${data.topicSlug}`;
}

export async function loadTopicQuizState(data: TopicTestPageData, options?: { forceNew?: boolean }) {
  let resumable = null;
  let userId: string | null = null;
  if (data.hasQuestions) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (user) resumable = await findResumableSession(supabase, user.id, data.unitId, data.topicId);

    // Bu konu için resume edilecek bir oturum yoksa (yani sıfırdan yeni bir oturum
    // açılacak), aynı ünitede zaten AÇIK bir ünite testi var mı diye bakılır — ikisi aynı
    // soru havuzunu paylaştığı için (kullanıcının 2026-09-06 isteği: "önce sorup kullanıcı
    // karar versin, sessizce üstüne yazma"). Varsa yeni test PLANLANMAZ, TestStatusCard bu
    // bilgiyi gösterip kullanıcıya seçim sunar — kullanıcı "Yeni Test Başlat" derse
    // forceNew:true ile tekrar çağrılır, o zaman eski oturum kapatılıp devam edilir.
    if (!resumable && user) {
      const conflict = await findConflictingSession(supabase, user.id, data.unitId, 'topic', {
        gradeSlug: data.gradeSlug,
        lessonSlug: data.lessonSlug,
        unitSlug: data.unitSlug,
      });
      if (conflict && !options?.forceNew) {
        return { resumable: null, conflict, initialQuestions: [] as QuizQuestion[], remainingQuestionIds: [] as number[], allCaughtUp: false };
      }
      if (conflict && options?.forceNew) {
        await supabase.from('test_sessions').update({ completed_at: new Date().toISOString() }).eq('id', conflict.sessionId).is('completed_at', null);
      }
    }
  }

  // Resume varsa (ya da hiç soru yoksa) tam liste tek seferde gelir — aşamalı yükleme sadece
  // yeni başlayan testlerde uygulanır, bkz. quizPageData.ts başındaki yorum ve QuizClient'taki
  // questionsFullyLoaded mantığı (resume'da çift test_sessions açılmasını önlemek için).
  if (resumable || !data.hasQuestions) {
    return { resumable, conflict: null, initialQuestions: resumable?.questions ?? [], remainingQuestionIds: [] as number[], allCaughtUp: false };
  }

  const plan = await planTopicTestQuestions(data.topicId, userId);
  const initialQuestions = plan.firstQuestion ? [plan.firstQuestion] : [];
  return { resumable: null, conflict: null, initialQuestions, remainingQuestionIds: plan.remainingQuestionIds, allCaughtUp: plan.allCaughtUp };
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
      .in('topic_id', topicIds)
      .eq('is_active', true);
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

export async function loadUnitQuizState(data: UnitTestPageData, options?: { forceNew?: boolean }) {
  let resumable = null;
  let userId: string | null = null;
  if (data.hasQuestions) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
    if (user) resumable = await findResumableSession(supabase, user.id, data.unitId, null);

    // Bu ünite için resume edilecek bir oturum yoksa, aynı ünitede zaten AÇIK bir konu
    // testi var mı diye bakılır — ikisi aynı soru havuzunu paylaşıyor (bkz. loadTopicQuizState'
    // teki aynı kontrol/gerekçe/forceNew akışı).
    if (!resumable && user) {
      const conflict = await findConflictingSession(supabase, user.id, data.unitId, 'unit', {
        gradeSlug: data.gradeSlug,
        lessonSlug: data.lessonSlug,
        unitSlug: data.unitSlug,
      });
      if (conflict && !options?.forceNew) {
        return { resumable: null, conflict, initialQuestions: [] as QuizQuestion[], remainingQuestionIds: [] as number[], allCaughtUp: false };
      }
      if (conflict && options?.forceNew) {
        await supabase.from('test_sessions').update({ completed_at: new Date().toISOString() }).eq('id', conflict.sessionId).is('completed_at', null);
      }
    }
  }

  if (resumable || !data.hasQuestions) {
    return { resumable, conflict: null, initialQuestions: resumable?.questions ?? [], remainingQuestionIds: [] as number[], allCaughtUp: false };
  }

  const plan = await planUnitTestQuestions(data.unitId, userId);
  const initialQuestions = plan.firstQuestion ? [plan.firstQuestion] : [];
  return { resumable: null, conflict: null, initialQuestions, remainingQuestionIds: plan.remainingQuestionIds, allCaughtUp: plan.allCaughtUp };
}
