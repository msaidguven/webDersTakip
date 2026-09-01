import type { SupabaseClient } from '@supabase/supabase-js';
import { Unit, Week } from '@/app/src/models/types';
import { getCurriculumCalendar } from './curriculumCalendar';
import { getCurrentCurriculumWeek } from './routeParsing';

type UnitRow = {
  id: number;
  title: string;
  question_count: number | null;
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
}

// WeeklyProgress kartlarında gösterilecek 5 haftalık pencereyi (mevcut haftanın bir öncesinden
// başlayarak) müfredat haftasına göre kurar. Haftaya tıklamanın o haftanın içeriğini yüklemesi
// kapsam dışı bırakıldı (bkz. docs/site-iyilestirme-plani.md tartışması) — sadece hangi haftanın
// geçmiş/şimdi/gelecek/kilitli olduğunu göstermek için gerçek veri kullanılıyor.
export function buildWeekWindow(currentWeek: number, totalWeeks: number): Week[] {
  const start = Math.max(1, currentWeek - 1);
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
      .select('id, title, question_count, order_no, start_week, end_week')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .eq('is_active', true)
      .order('order_no', { ascending: true }),
    supabase.from('lessons').select('name').eq('id', lessonId).maybeSingle(),
    supabase.from('grades').select('name').eq('id', gradeId).maybeSingle(),
  ]);

  const units = (unitsData as UnitRow[] | null) || [];
  const lessonName = (lesson as { name: string } | null)?.name ?? null;
  const gradeName = (grade as { name: string } | null)?.name ?? null;

  if (units.length === 0) {
    const totalWeeks = 38;
    return { units: [], lessonName, gradeName, totalWeeks, currentWeek: getCurrentCurriculumWeek(totalWeeks, termStartDate, breaks) };
  }

  const unitIds = units.map((u) => u.id);

  const [{ data: topicRows }, { data: summaryRows }] = await Promise.all([
    supabase.from('topics').select('unit_id').in('unit_id', unitIds).eq('is_active', true),
    supabase
      .from('user_unit_summary')
      .select('unit_id, solved_question_count, correct_count, wrong_count')
      .eq('user_id', userId)
      .in('unit_id', unitIds),
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
    const totalQuestions = u.question_count ?? 0;
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
    };
  });

  return { units: mapped, lessonName, gradeName, currentWeek, totalWeeks };
}
