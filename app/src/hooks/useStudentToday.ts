'use client';

// Girişli öğrencinin anasayfası ("Bugün", yol haritası 3a — 2026-09-27) için kişisel veri.
// Anasayfa herkese aynı HTML'i veren ISR sayfası (Google misafir halini görür), bu yüzden
// kişisel kısım oturum açıldıktan sonra tarayıcıda, panelin zaten kullandığı fonksiyonlarla
// (RLS: sadece kendi satırları) PARALEL çekiliyor — yeni sorgu/RPC yok.
import useSWR from 'swr';
import { useAuth } from '@/app/src/context/AuthContext';
import { getCurrentStreak, getTodayQuestionCount, getWeeklyActiveDays, parseDailyGoal } from '@/app/src/lib/dashboardStreak';
import { getDueSrsCount } from '@/app/src/lib/dashboardSrs';
import { getRecentActivities } from '@/app/src/lib/dashboardActivities';
import { getDashboardLessons } from '@/app/src/lib/dashboardLessons';
import { getWeeklyLeaderboard } from '@/app/src/lib/leaderboard';
import type { LessonProgress } from '@/app/src/models/types';
import { getLessonNextSteps, sequentialTestHref, type LessonNextStep } from '@/app/src/lib/sequentialTest';

export type TodayTask =
  | { kind: 'resume'; title: string; answered: number; total: number; href: string }
  | { kind: 'srs'; count: number; href: string }
  | { kind: 'weak'; topicTitle: string; lessonName: string; wrongCount: number; accuracy: number | null; href: string }
  | { kind: 'goal'; remaining: number; href: string }
  | { kind: 'done' };

export interface OpenTest {
  title: string;
  answered: number;
  total: number;
  href: string;
}

export interface StudentToday {
  firstName: string;
  gradeName: string | null;
  streak: number;
  dailyProgress: number;
  dailyGoal: number;
  weeklyActiveDays: boolean[];
  rank: { position: number; toPass: number | null } | null;
  lessons: LessonProgress[];
  // Ders id → "Sıradaki 10 soru" adımı (Derslerim kartları). RPC yoksa/hata verirse boş.
  nextSteps: Map<number, LessonNextStep>;
  // Ders id → o dersteki EN SON yarım kalan test (Derslerim kartında önce bitirilsin diye).
  openTestByLesson: Map<number, OpenTest>;
  // Öncelik sırasına göre: [0] ana görev, sonrakiler "sonra" önerileri.
  tasks: TodayTask[];
}

function buildTasks(input: {
  resumable: { title: string; answered: number; total: number; href: string } | null;
  dueSrs: number;
  lessons: LessonProgress[];
  dailyProgress: number;
  dailyGoal: number;
  nextSteps: Map<number, LessonNextStep>;
}): TodayTask[] {
  const tasks: TodayTask[] = [];
  if (input.resumable) tasks.push({ kind: 'resume', ...input.resumable });
  if (input.dueSrs > 0) tasks.push({ kind: 'srs', count: input.dueSrs, href: '/tekrar' });
  const weakest = input.lessons
    .filter((l) => l.weakTopic)
    // İlerlemem'deki listeyle aynı sıra: en düşük doğruluk önce, eşitlikte yanlışı çok olan.
    .sort((a, b) => (a.weakTopic!.accuracy ?? 100) - (b.weakTopic!.accuracy ?? 100) || b.weakTopic!.wrongCount - a.weakTopic!.wrongCount)[0];
  if (weakest?.weakTopic) {
    tasks.push({ kind: 'weak', topicTitle: weakest.weakTopic.title, lessonName: weakest.name, wrongCount: weakest.weakTopic.wrongCount, accuracy: weakest.weakTopic.accuracy, href: weakest.weakTopic.href });
  }
  const remaining = Math.max(0, input.dailyGoal - input.dailyProgress);
  if (remaining > 0) {
    // En az ilerlenmiş, sorusu olan derse yönlendir — "nereden başlayayım" sorusunu kapatır.
    // Sıradaki soru kuyruğu varsa doğrudan o teste (Derslerim'deki "Sıradaki 10 soru" ile aynı).
    const target = input.lessons.filter((l) => l.soruBankasiHref && l.totalQuestions > 0).sort((a, b) => a.progress - b.progress)[0];
    const step = target ? input.nextSteps.get(Number(target.id)) : undefined;
    const href = step && step.remaining > 0 ? sequentialTestHref(step.lessonId) : target?.soruBankasiHref ?? '/soru-bankasi';
    tasks.push({ kind: 'goal', remaining, href });
  }
  if (!tasks.length) tasks.push({ kind: 'done' });
  return tasks;
}

async function loadStudentToday(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<StudentToday> {
  const { data: profile } = await supabase.from('profiles').select('full_name, grade_id, daily_goal').eq('id', userId).maybeSingle();
  const dailyGoal = parseDailyGoal((profile as { daily_goal?: number } | null)?.daily_goal);
  const fullName = ((profile as { full_name: string | null } | null)?.full_name || '').trim();
  const profileGradeId = (profile as { grade_id: number | null } | null)?.grade_id ?? null;

  const [streak, dailyProgress, weeklyActiveDays, dueSrs, activities, lessonsResult, leaderboard, nextSteps] = await Promise.all([
    getCurrentStreak(supabase, userId),
    getTodayQuestionCount(supabase, userId),
    getWeeklyActiveDays(supabase, userId),
    getDueSrsCount(supabase, userId, profileGradeId),
    getRecentActivities(supabase, userId, 12),
    getDashboardLessons(supabase, userId, profileGradeId),
    getWeeklyLeaderboard(supabase),
    profileGradeId ? getLessonNextSteps(supabase, profileGradeId).catch(() => new Map<number, LessonNextStep>()) : Promise.resolve(new Map<number, LessonNextStep>()),
  ]);

  const resumeActivity = activities.find((a) => a.isComplete === false && a.resumeHref);
  const resumable = resumeActivity
    ? {
        title: resumeActivity.baseTitle ?? resumeActivity.title,
        answered: resumeActivity.questionCount,
        total: resumeActivity.totalQuestionCount ?? resumeActivity.questionCount,
        href: resumeActivity.resumeHref!,
      }
    : null;

  // activities yeniden eskiye sıralı — ilk görülen, o dersin en son yarım testi.
  const openTestByLesson = new Map<number, OpenTest>();
  for (const a of activities) {
    if (a.isComplete !== false || !a.resumeHref || a.lessonId == null || a.questionCount === 0) continue;
    if (openTestByLesson.has(a.lessonId)) continue;
    openTestByLesson.set(a.lessonId, {
      title: a.baseTitle ?? a.title,
      answered: a.questionCount,
      total: a.totalQuestionCount ?? a.questionCount,
      href: a.resumeHref,
    });
  }

  const me = leaderboard.find((e) => e.isMe);
  const above = me && me.rank > 1 ? leaderboard[me.rank - 2] : null;
  const lessons = lessonsResult?.lessons ?? [];

  return {
    firstName: fullName.split(/\s+/)[0] || 'Öğrenci',
    gradeName: lessonsResult?.gradeName ?? null,
    streak,
    dailyProgress,
    dailyGoal,
    weeklyActiveDays,
    rank: me ? { position: me.rank, toPass: above ? above.totalQuestions - me.totalQuestions + 1 : null } : null,
    lessons,
    nextSteps,
    openTestByLesson,
    tasks: buildTasks({ resumable, dueSrs, lessons, dailyProgress, dailyGoal, nextSteps }),
  };
}

export function useStudentToday() {
  const { user, supabase } = useAuth();
  return useSWR(user ? ['student-today', user.id] : null, () => loadStudentToday(supabase, user!.id), {
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
  });
}
