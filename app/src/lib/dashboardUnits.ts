import type { SupabaseClient } from '@supabase/supabase-js';
import { TopicProgress, TopicProgressStatus, Unit, Week } from '@/app/src/models/types';
import { getCurriculumCalendar } from './curriculumCalendar';
import { getCurrentCurriculumWeek } from './routeParsing';
import { getQuestionCountsByUnitId } from './questionCounts';

type UnitRow = {
  id: number;
  title: string;
  slug: string | null;
  order_no: number;
  start_week: number | null;
  end_week: number | null;
};

type SummaryRow = { unit_id: number; solved_question_count: number; correct_count: number; wrong_count: number };

export interface DashboardUnitsResult {
  units: Unit[];
  lessonName: string | null;
  gradeName: string | null;
  currentWeek: number;
  totalWeeks: number;
  activeUnitTitle: string | null;
  activeUnitTopics: TopicProgress[];
}

// Aktif ünitenin konularını, ikisi de birbirinden BAĞIMSIZ iki ayrı durumla döner
// (bkz. docs/site-iyilestirme-plani.md tartışması, 2026-09-02) — birleşik tek bir
// "konu tamamlandı" rozeti bilinçli olarak YOK:
//   - contentStatus: konu anlatımı — kullanıcı "Konuyu Bitirdim" butonuna basmadan
//     asla 'completed' olmaz (user_topic_content_progress.is_completed).
//   - questionStatus: sorular — havuzdaki her soru en az bir kez denenince 'completed'
//     olur (user_question_stats.total_attempts > 0); SRS'in next_review_at'i burada
//     YOK SAYILIR, yani bir kez tamamlanan konu tekrar zamanı geldiğinde geri dönmez.
async function getActiveUnitTopics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  unitId: number,
  gradeSlug: string | null,
  lessonSlug: string | null,
  unitSlug: string | null
): Promise<TopicProgress[]> {
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, title, slug, order_no')
    .eq('unit_id', unitId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const topics = (topicsData as { id: number; title: string; slug: string | null; order_no: number }[] | null) || [];
  if (!topics.length) return [];

  const topicIds = topics.map((t) => t.id);

  const [{ data: contentProgressData }, { data: questionsData }] = await Promise.all([
    supabase
      .from('user_topic_content_progress')
      .select('topic_id, is_completed')
      .eq('user_id', userId)
      .in('topic_id', topicIds),
    supabase.from('questions').select('id, topic_id').in('topic_id', topicIds),
  ]);

  const contentCompletedByTopic = new Map<number, boolean>();
  for (const row of (contentProgressData as { topic_id: number; is_completed: boolean }[] | null) || []) {
    contentCompletedByTopic.set(row.topic_id, row.is_completed);
  }

  const questionIdsByTopic = new Map<number, number[]>();
  const allQuestionIds: number[] = [];
  for (const row of (questionsData as { id: number; topic_id: number }[] | null) || []) {
    const list = questionIdsByTopic.get(row.topic_id) || [];
    list.push(row.id);
    questionIdsByTopic.set(row.topic_id, list);
    allQuestionIds.push(row.id);
  }

  const attemptedQuestionIds = new Set<number>();
  if (allQuestionIds.length) {
    const { data: statsData } = await supabase
      .from('user_question_stats')
      .select('question_id')
      .eq('user_id', userId)
      .in('question_id', allQuestionIds)
      .gt('total_attempts', 0);
    for (const row of (statsData as { question_id: number }[] | null) || []) {
      attemptedQuestionIds.add(row.question_id);
    }
  }

  const canBuildHref = !!(gradeSlug && lessonSlug && unitSlug);

  return topics.map((t) => {
    const contentStatus: TopicProgressStatus = !contentCompletedByTopic.has(t.id)
      ? 'not_started'
      : contentCompletedByTopic.get(t.id)
        ? 'completed'
        : 'in_progress';

    const topicQuestionIds = questionIdsByTopic.get(t.id) || [];
    const attemptedCount = topicQuestionIds.filter((id) => attemptedQuestionIds.has(id)).length;
    const questionStatus: TopicProgressStatus =
      topicQuestionIds.length === 0 || attemptedCount === 0
        ? 'not_started'
        : attemptedCount === topicQuestionIds.length
          ? 'completed'
          : 'in_progress';

    const contentHref = canBuildHref && t.slug ? `/${gradeSlug}/${lessonSlug}/${unitSlug}/${t.slug}` : undefined;
    // Sorusu hiç olmayan bir konuda "Soru Çöz" linki/duruma hiç gösterilmez —
    // aksi halde hiçbir zaman ilerlemeyecek kalıcı bir "Başlanmadı" rozeti kalırdı.
    const quizHref = contentHref && topicQuestionIds.length > 0 ? `${contentHref}/kavrama-testi` : undefined;

    return {
      id: String(t.id),
      title: t.title,
      contentStatus,
      questionStatus: quizHref ? questionStatus : undefined,
      contentHref,
      quizHref,
    };
  });
}

// WeeklyProgress kartlarında gösterilecek 5 haftalık pencereyi (mevcut haftanın bir öncesinden
// başlayarak) müfredat haftasına göre kurar. Haftaya tıklamanın o haftanın içeriğini yüklemesi
// kapsam dışı bırakıldı (bkz. docs/site-iyilestirme-plani.md tartışması) — sadece hangi haftanın
// geçmiş/şimdi/gelecek/kilitli olduğunu göstermek için gerçek veri kullanılıyor.
export function buildWeekWindow(windowStart: number, currentWeek: number, totalWeeks: number): Week[] {
  const start = Math.max(1, windowStart);
  const weeks: Week[] = [];
  for (let n = start; n < start + 5; n++) {
    let status: Week['status'];
    let label: string;
    if (n > totalWeeks) {
      status = 'locked';
      label = 'Kilitli';
    } else if (n < currentWeek) {
      status = 'past';
      label = 'Geçen';
    } else if (n === currentWeek) {
      status = 'current';
      label = 'Şimdi';
    } else {
      status = 'future';
      label = 'Gelecek';
    }
    weeks.push({ id: n, number: n, label, status });
  }
  return weeks;
}

// Kullanıcının profildeki (varsa) grade_id'siyle en son test_sessions kaydından türetilen
// ders bağlamı için ünite listesini gerçek veriden kurar. Panel bir "sınıf/ders" seçimi
// tutmadığı için (bkz. app/src/viewmodels/useHomeViewModel.ts akışı) en son pratik yaptığı
// ders/sınıf en makul varsayılan bağlamdır; hiç test_sessions kaydı yoksa null döner ve
// çağıran taraf "henüz bir derse başlamadın" boş durumunu gösterir.
export async function getDashboardUnitsData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
  profileGradeId: number | null
): Promise<DashboardUnitsResult | null> {
  let sessionQuery = supabase
    .from('test_sessions')
    .select('lesson_id, grade_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (profileGradeId) sessionQuery = sessionQuery.eq('grade_id', profileGradeId);
  let { data: sessionRows } = await sessionQuery;

  if (!sessionRows?.length && profileGradeId) {
    const { data: anySessionRows } = await supabase
      .from('test_sessions')
      .select('lesson_id, grade_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    sessionRows = anySessionRows;
  }

  const session = sessionRows?.[0] as { lesson_id: number; grade_id: number } | undefined;
  if (!session) return null;

  const { lesson_id: lessonId, grade_id: gradeId } = session;
  const { termStartDate, breaks } = await getCurriculumCalendar(supabase);

  const [{ data: unitsData }, { data: lesson }, { data: grade }] = await Promise.all([
    supabase
      .from('units')
      .select('id, title, slug, order_no, start_week, end_week')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .eq('is_active', true)
      .order('order_no', { ascending: true }),
    supabase.from('lessons').select('name, slug').eq('id', lessonId).maybeSingle(),
    supabase.from('grades').select('name, slug').eq('id', gradeId).maybeSingle(),
  ]);

  const units = (unitsData as UnitRow[] | null) || [];
  const lessonRow = lesson as { name: string; slug: string | null } | null;
  const gradeRow = grade as { name: string; slug: string | null } | null;
  const lessonName = lessonRow?.name ?? null;
  const gradeName = gradeRow?.name ?? null;

  if (units.length === 0) {
    const totalWeeks = 38;
    return {
      units: [],
      lessonName,
      gradeName,
      totalWeeks,
      currentWeek: getCurrentCurriculumWeek(totalWeeks, termStartDate, breaks),
      activeUnitTitle: null,
      activeUnitTopics: [],
    };
  }

  const unitIds = units.map((u) => u.id);

  const [{ data: topicRows }, { data: summaryRows }, questionCountByUnit] = await Promise.all([
    supabase.from('topics').select('unit_id').in('unit_id', unitIds).eq('is_active', true),
    supabase
      .from('user_unit_summary')
      .select('unit_id, solved_question_count, correct_count, wrong_count')
      .eq('user_id', userId)
      .in('unit_id', unitIds),
    getQuestionCountsByUnitId(supabase, unitIds),
  ]);

  const topicCountByUnit = new Map<number, number>();
  for (const row of (topicRows as { unit_id: number }[] | null) || []) {
    topicCountByUnit.set(row.unit_id, (topicCountByUnit.get(row.unit_id) || 0) + 1);
  }

  const summaryByUnit = new Map<number, SummaryRow>();
  for (const row of (summaryRows as SummaryRow[] | null) || []) {
    summaryByUnit.set(row.unit_id, row);
  }

  const totalWeeks = units.reduce((max, u) => Math.max(max, u.end_week ?? u.start_week ?? 0), 0) || 30;
  const currentWeek = getCurrentCurriculumWeek(totalWeeks, termStartDate, breaks);

  const mapped: Unit[] = units.map((u) => {
    const totalQuestions = questionCountByUnit.get(u.id) ?? 0;
    const totalTopics = topicCountByUnit.get(u.id) ?? 0;
    const summary = summaryByUnit.get(u.id);
    const solved = summary?.solved_question_count ?? 0;
    const startWeek = u.start_week ?? 1;
    const endWeek = u.end_week ?? startWeek;

    const isLocked = currentWeek < startWeek;
    const isCompleted = !isLocked && totalQuestions > 0 && solved >= totalQuestions;
    const status: Unit['status'] = isLocked ? 'locked' : isCompleted ? 'completed' : 'in_progress';
    const progress = totalQuestions > 0 ? Math.min(100, Math.round((solved / totalQuestions) * 100)) : 0;
    const answered = (summary?.correct_count ?? 0) + (summary?.wrong_count ?? 0);
    const successRate = answered > 0 ? Math.round(((summary?.correct_count ?? 0) / answered) * 100) : undefined;

    const weekLabel = startWeek === endWeek ? `${startWeek}. Hafta` : `${startWeek}-${endWeek}. Hafta`;
    const subtitle = isLocked
      ? `${weekLabel} • Kilitli`
      : isCompleted
        ? `${weekLabel} • Tamamlandı`
        : `${weekLabel} • ${totalTopics} Konu • ${totalQuestions} Soru`;

    const href = gradeRow?.slug && lessonRow?.slug && u.slug
      ? `/${gradeRow.slug}/${lessonRow.slug}/${u.slug}/unite-testi`
      : undefined;

    return {
      id: String(u.id),
      title: u.title,
      subtitle,
      weekNumber: startWeek,
      totalTopics,
      totalQuestions,
      progress,
      status,
      successRate,
      href,
    };
  });

  // Panelin "Devam Edilen Konular" listesi için aktif ünite: kilitli olmayan,
  // henüz tamamlanmamış ilk ünite (müfredat sırasına göre) — kullanıcının
  // şu an fiilen çalışıyor olması beklenen ünite. Hiçbiri bu duruma uymuyorsa
  // (hepsi tamamlanmış/kilitli) liste boş kalır, panelde bölüm hiç gösterilmez.
  const activeUnit = mapped.find((u) => u.status === 'in_progress') ?? null;
  const activeUnitRaw = activeUnit ? units.find((u) => String(u.id) === activeUnit.id) ?? null : null;
  const activeUnitTopics = activeUnitRaw
    ? await getActiveUnitTopics(supabase, userId, activeUnitRaw.id, gradeRow?.slug ?? null, lessonRow?.slug ?? null, activeUnitRaw.slug)
    : [];

  return {
    units: mapped,
    lessonName,
    gradeName,
    currentWeek,
    totalWeeks,
    activeUnitTitle: activeUnit?.title ?? null,
    activeUnitTopics,
  };
}
