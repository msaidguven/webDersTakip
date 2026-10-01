// "Sıradaki 10 soru" (2026-10-01): dersin başından müfredat sırasıyla, öğrencinin hiç çözmediği
// sorular. Kural ve takvim sınırı SQL'de (supabase/migrations/sequential_question_queue.sql);
// burada sadece okulun şu anki haftası hesaplanır (tatil/dönem başı mantığı TS'te,
// anasayfadaki "Okulda bu hafta" ile aynı fonksiyonlar).
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurriculumCalendar } from './curriculumCalendar';
import { getCurrentCurriculumWeek } from './routeParsing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

export const SEQUENTIAL_TEST_SIZE = 10;
const TOTAL_WEEKS = 38;

export function sequentialTestHref(lessonId: number | string): string {
  return `/sirali-test/${lessonId}`;
}

export async function getCurrentSchoolWeek(supabase: Client): Promise<number> {
  const calendar = await getCurriculumCalendar(supabase);
  return getCurrentCurriculumWeek(TOTAL_WEEKS, calendar.termStartDate, calendar.breaks);
}

export async function getNextQuestionIds(supabase: Client, gradeId: number, lessonId: number): Promise<number[]> {
  const week = await getCurrentSchoolWeek(supabase);
  const { data, error } = await supabase.rpc('get_my_next_questions', {
    p_grade_id: gradeId,
    p_lesson_id: lessonId,
    p_week: week,
    p_limit: SEQUENTIAL_TEST_SIZE,
  });
  if (error) throw error;
  return ((data as { question_id: number }[] | null) ?? []).map((r) => r.question_id);
}

export interface LessonNextStep {
  lessonId: number;
  remaining: number;
  hasCalendar: boolean;
  nextTopic: { id: number; title: string; unitSlug: string | null; slug: string | null; viewed: boolean; completed: boolean } | null;
}

type NextStepRow = {
  lesson_id: number;
  remaining: number;
  has_calendar: boolean;
  next_topic_id: number | null;
  next_topic_title: string | null;
  next_unit_slug: string | null;
  next_topic_slug: string | null;
  next_topic_viewed: boolean;
  next_topic_completed: boolean;
};

export async function getLessonNextSteps(supabase: Client, gradeId: number): Promise<Map<number, LessonNextStep>> {
  const week = await getCurrentSchoolWeek(supabase);
  const { data, error } = await supabase.rpc('get_my_lesson_next_steps', { p_grade_id: gradeId, p_week: week });
  if (error) throw error;
  const map = new Map<number, LessonNextStep>();
  for (const r of (data as NextStepRow[] | null) ?? []) {
    map.set(r.lesson_id, {
      lessonId: r.lesson_id,
      remaining: r.remaining,
      hasCalendar: r.has_calendar,
      nextTopic:
        r.next_topic_id != null && r.next_topic_title
          ? { id: r.next_topic_id, title: r.next_topic_title, unitSlug: r.next_unit_slug, slug: r.next_topic_slug, viewed: r.next_topic_viewed, completed: r.next_topic_completed }
          : null,
    });
  }
  return map;
}
