'use client';

// Girişli öğrencinin anasayfası ("Bugün", yol haritası 3a — 2026-09-27) için kişisel veri.
// Anasayfa herkese aynı HTML'i veren ISR sayfası (Google misafir halini görür), bu yüzden
// kişisel kısım oturum açıldıktan sonra tarayıcıda, panelin zaten kullandığı fonksiyonlarla
// (RLS: sadece kendi satırları) PARALEL çekiliyor — yeni sorgu/RPC yok.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { getCurrentStreak, getTodayQuestionCount, getWeeklyActiveDays, DAILY_GOAL_QUESTIONS } from '@/app/src/lib/dashboardStreak';
import { getDueSrsCount } from '@/app/src/lib/dashboardSrs';
import { getRecentActivities } from '@/app/src/lib/dashboardActivities';
import { getDashboardLessons } from '@/app/src/lib/dashboardLessons';
import { getWeeklyLeaderboard } from '@/app/src/lib/leaderboard';
import type { LessonProgress } from '@/app/src/models/types';

export type TodayTask =
  | { kind: 'resume'; title: string; answered: number; total: number; href: string }
  | { kind: 'srs'; count: number; href: string }
  | { kind: 'weak'; topicTitle: string; lessonName: string; wrongCount: number; href: string }
  | { kind: 'goal'; remaining: number; href: string }
  | { kind: 'done' };

export interface StudentToday {
  firstName: string;
  gradeName: string | null;
  streak: number;
  dailyProgress: number;
  dailyGoal: number;
  weeklyActiveDays: boolean[];
  rank: { position: number; toPass: number | null } | null;
  lessons: LessonProgress[];
  // Öncelik sırasına göre: [0] ana görev, sonrakiler "sonra" önerileri.
  tasks: TodayTask[];
}

function buildTasks(input: {
  resumable: { title: string; answered: number; total: number; href: string } | null;
  dueSrs: number;
  lessons: LessonProgress[];
  dailyProgress: number;
  dailyGoal: number;
}): TodayTask[] {
  const tasks: TodayTask[] = [];
  if (input.resumable) tasks.push({ kind: 'resume', ...input.resumable });
  if (input.dueSrs > 0) tasks.push({ kind: 'srs', count: input.dueSrs, href: '/tekrar' });
  const weakest = input.lessons
    .filter((l) => l.weakTopic)
    .sort((a, b) => (b.weakTopic!.wrongCount - a.weakTopic!.wrongCount))[0];
  if (weakest?.weakTopic) {
    tasks.push({ kind: 'weak', topicTitle: weakest.weakTopic.title, lessonName: weakest.name, wrongCount: weakest.weakTopic.wrongCount, href: weakest.weakTopic.href });
  }
  const remaining = Math.max(0, input.dailyGoal - input.dailyProgress);
  if (remaining > 0) {
    // En az ilerlenmiş, sorusu olan derse yönlendir — "nereden başlayayım" sorusunu kapatır.
    const target = input.lessons.filter((l) => l.soruBankasiHref && l.totalQuestions > 0).sort((a, b) => a.progress - b.progress)[0];
    tasks.push({ kind: 'goal', remaining, href: target?.soruBankasiHref ?? '/soru-bankasi' });
  }
  if (!tasks.length) tasks.push({ kind: 'done' });
  return tasks;
}

async function loadStudentToday(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<StudentToday> {
  const { data: profile } = await supabase.from('profiles').select('full_name, grade_id').eq('id', userId).maybeSingle();
  const fullName = ((profile as { full_name: string | null } | null)?.full_name || '').trim();
  const profileGradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;

  const [streak, dailyProgress, weeklyActiveDays, dueSrs, activities, lessonsResult, leaderboard] = await Promise.all([
    getCurrentStreak(supabase, userId),
    getTodayQuestionCount(supabase, userId),
    getWeeklyActiveDays(supabase, userId),
    getDueSrsCount(supabase, userId, profileGradeId),
    getRecentActivities(supabase, userId, 12),
    getDashboardLessons(supabase, userId, profileGradeId),
    getWeeklyLeaderboard(supabase),
  ]);

  const resumeActivity = activities.find((a) => a.isComplete === false && a.resumeHref);
  const resumable = resumeActivity
    ? {
        title: resumeActivity.title.replace(/\s*\(Yarım Kaldı\)\s*$/, ''),
        answered: resumeActivity.questionCount,
        total: resumeActivity.totalQuestionCount ?? resumeActivity.questionCount,
        href: resumeActivity.resumeHref!,
      }
    : null;

  const me = leaderboard.find((e) => e.isMe);
  const above = me && me.rank > 1 ? leaderboard[me.rank - 2] : null;
  const lessons = lessonsResult?.lessons ?? [];

  return {
    firstName: fullName.split(/\s+/)[0] || 'Öğrenci',
    gradeName: lessonsResult?.gradeName ?? null,
    streak,
    dailyProgress,
    dailyGoal: DAILY_GOAL_QUESTIONS,
    weeklyActiveDays,
    rank: me ? { position: me.rank, toPass: above ? above.totalQuestions - me.totalQuestions + 1 : null } : null,
    lessons,
    tasks: buildTasks({ resumable, dueSrs, lessons, dailyProgress, dailyGoal: DAILY_GOAL_QUESTIONS }),
  };
}

export function useStudentToday() {
  const { user, supabase } = useAuth();
  return useSWR(user ? ['student-today', user.id] : null, () => loadStudentToday(supabase, user!.id), {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });
}
