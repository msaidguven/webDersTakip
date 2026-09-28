import type { SupabaseClient } from '@supabase/supabase-js';
import { LessonProgress } from '@/app/src/models/types';
import { buildSoruBankasiLessonPath, buildSoruBankasiUnitPath } from './soruBankasiPaths';

export interface DashboardLessonsResult {
  gradeId: number;
  gradeName: string | null;
  lessons: LessonProgress[];
  // RPC hatası (ör. migration çalıştırılmamış) — "sınıf seçilmemiş" ile karıştırılmamalı.
  failed: boolean;
}

type Row = {
  lesson_id: number;
  lesson_name: string;
  lesson_slug: string | null;
  icon: string;
  grade_slug: string | null;
  total_questions: number;
  solved_questions: number;
  correct_answers: number;
  wrong_answers: number;
  weak_topic_title: string | null;
  weak_topic_unit_slug: string | null;
  weak_topic_slug: string | null;
  weak_topic_wrong: number | null;
};

// Panel ders kartları (2026-09-26 sadeleştirmesi): üniteler panelde gösterilmiyor, her ders
// tek kartta özetlenip Soru Bankası'na yönlendiriliyor. Tüm sayılar tek RPC'den gelir
// (get_my_lesson_progress) — Soru Bankası'ndaki konu/ünite rozetleriyle aynı tanımlar.
// Sınıf önce profildeki grade_id'den, o yoksa (nadir: profilde sınıf seçilmemiş ama daha
// önce test çözülmüş) en son test_sessions kaydından belirlenir; ikisi de yoksa null.
export async function getDashboardLessons(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileGradeId: number | null
): Promise<DashboardLessonsResult | null> {
  let gradeId = profileGradeId;

  if (!gradeId) {
    const { data: sessionRows } = await supabase
      .from('test_sessions')
      .select('grade_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    gradeId = (sessionRows?.[0] as { grade_id: number } | undefined)?.grade_id ?? null;
  }

  if (!gradeId) return null;

  const [{ data, error }, { data: grade }] = await Promise.all([
    supabase.rpc('get_my_lesson_progress', { p_grade_id: gradeId }),
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
  ]);
  if (error) console.error('get_my_lesson_progress error:', error.message);

  const lessons = ((data as Row[] | null) || []).map((row): LessonProgress => {
    const canLink = !!(row.grade_slug && row.lesson_slug);
    const weakTopicHref =
      canLink && row.weak_topic_unit_slug && row.weak_topic_slug
        ? `${buildSoruBankasiUnitPath(row.grade_slug!, row.lesson_slug!, row.weak_topic_unit_slug)}/${row.weak_topic_slug}`
        : undefined;

    return {
      id: String(row.lesson_id),
      name: row.lesson_name,
      icon: row.icon || '📘',
      totalQuestions: row.total_questions,
      solvedQuestions: row.solved_questions,
      correctAnswers: row.correct_answers,
      wrongAnswers: row.wrong_answers,
      progress: row.total_questions > 0 ? Math.min(100, Math.round((row.solved_questions / row.total_questions) * 100)) : 0,
      soruBankasiHref: canLink ? buildSoruBankasiLessonPath(row.grade_slug!, row.lesson_slug!) : undefined,
      lessonHref: canLink ? `/${row.grade_slug}/${row.lesson_slug}` : undefined,
      weakTopic:
        row.weak_topic_title && weakTopicHref
          ? { title: row.weak_topic_title, wrongCount: row.weak_topic_wrong ?? 0, href: weakTopicHref }
          : null,
    };
  });

  return { gradeId, gradeName: (grade as { name: string } | null)?.name ?? null, lessons, failed: !!error };
}
