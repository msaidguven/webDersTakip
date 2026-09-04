import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export interface PublicQuestionContext {
  questionId: number;
  gradeId: number;
  lessonId: number;
  unitId: number;
  topicId: number;
  gradeSlug: string;
  lessonSlug: string;
  unitSlug: string;
  topicSlug: string;
  gradeName: string;
  lessonName: string;
  unitTitle: string;
  topicTitle: string;
}

type ChainRow = {
  id: number;
  is_active: boolean;
  topics: {
    id: number;
    title: string;
    slug: string | null;
    is_active: boolean;
    units: {
      id: number;
      title: string;
      slug: string | null;
      is_active: boolean;
      grades: { id: number; name: string; slug: string | null } | { id: number; name: string; slug: string | null }[] | null;
      lessons: { id: number; name: string; slug: string | null } | { id: number; name: string; slug: string | null }[] | null;
    } | { id: number; title: string; slug: string | null; is_active: boolean; grades: unknown; lessons: unknown }[] | null;
  } | { id: number; title: string; slug: string | null; is_active: boolean; units: unknown }[] | null;
};

// Eski /soru/[id] linklerini /soru-bankasi/.../[konu]?soru=ID'e 301 ile yönlendirmek için:
// bir sorunun ait olduğu sınıf/ders/ünite/konu bağlamını (slug'lar + başlıklar) çözer. Sorunun
// kendisi (ör. SVG bekleyen taslak), konu ya da ünite pasifse (is_active=false) null döner —
// isViewerAdmin bypass'ı OLMADAN aynı
// görünürlük kuralına tabi (bkz. quizPageData.ts'teki non-admin davranışı), taslak bir
// konunun eski linki yeni sayfaya değil 404'e düşer.
export async function getPublicQuestionContext(questionId: number): Promise<PublicQuestionContext | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('questions')
    .select(
      `id, is_active, topics!inner(id, title, slug, is_active, units!inner(id, title, slug, is_active, grades!inner(id, name, slug), lessons!inner(id, name, slug)))`
    )
    .eq('id', questionId)
    .maybeSingle();

  const row = data as ChainRow | null;
  if (!row || !row.is_active) return null;

  const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics;
  if (!topic || !topic.is_active) return null;

  const unit = Array.isArray(topic.units) ? topic.units[0] : topic.units;
  if (!unit || !unit.is_active) return null;

  const grade = Array.isArray(unit.grades) ? unit.grades[0] : unit.grades;
  const lesson = Array.isArray(unit.lessons) ? unit.lessons[0] : unit.lessons;
  if (!grade?.slug || !lesson?.slug || !unit.slug || !topic.slug) return null;

  return {
    questionId,
    gradeId: grade.id,
    lessonId: lesson.id,
    unitId: unit.id,
    topicId: topic.id,
    gradeSlug: grade.slug,
    lessonSlug: lesson.slug,
    unitSlug: unit.slug,
    topicSlug: topic.slug,
    gradeName: grade.name,
    lessonName: lesson.name,
    unitTitle: unit.title,
    topicTitle: topic.title,
  };
}
