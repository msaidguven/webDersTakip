import type { SupabaseClient } from '@supabase/supabase-js';

export type RecalculateWeeksResult = {
  updated: { id: number; start_week: number; end_week: number }[];
  warnings: string[];
};

type LessonGradeRow = { weekly_hours: number | null };
type UnitRow = { id: number; title: string; order_no: number; duration_hours: number | null };
type BreakRow = { curriculum_week: number };

// lesson_id + grade_id için aktif üniteleri order_no sırasına göre haftalara yerleştirir.
// special_week_events'teki (event_type='break') tatil haftaları atlanır.
// Bir ünitede duration_hours eksikse hesaplama hiç yapılmaz (bkz. plan: bunu sessizce
// atlamak, o ünitenin eski haftalarıyla sonraki ünitelerin çakışmasına yol açardı).
export async function recalculateUnitWeeks(
  supabase: SupabaseClient,
  lessonId: number,
  gradeId: number
): Promise<RecalculateWeeksResult> {
  const { data: lessonGrade } = await supabase
    .from('lesson_grades')
    .select('weekly_hours')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();

  const weeklyHours = (lessonGrade as LessonGradeRow | null)?.weekly_hours;
  if (!weeklyHours) {
    return { updated: [], warnings: ['Bu ders+sınıf için haftalık ders saati tanımlı değil'] };
  }

  const { data: unitRows } = await supabase
    .from('units')
    .select('id, title, order_no, duration_hours')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .eq('is_active', true)
    .order('order_no', { ascending: true });

  const units = (unitRows as UnitRow[] | null) || [];
  if (!units.length) return { updated: [], warnings: [] };

  const missingDuration = units.filter((u) => !u.duration_hours);
  if (missingDuration.length) {
    return {
      updated: [],
      warnings: [`Şu ünite(ler)de süre (duration_hours) eksik, önce doldurun: ${missingDuration.map((u) => u.title).join(', ')}`],
    };
  }

  const { data: breakRows } = await supabase
    .from('special_week_events')
    .select('curriculum_week')
    .eq('event_type', 'break')
    .eq('is_active', true)
    .or(`grade_id.is.null,grade_id.eq.${gradeId}`)
    .or(`lesson_id.is.null,lesson_id.eq.${lessonId}`);

  const breakWeeks = new Set(((breakRows as BreakRow[] | null) || []).map((r) => r.curriculum_week));

  const updated: { id: number; start_week: number; end_week: number }[] = [];
  let cursor = 1;

  for (const unit of units) {
    const needed = Math.ceil((unit.duration_hours as number) / weeklyHours);

    while (breakWeeks.has(cursor)) cursor++;
    const startWeek = cursor;

    let assigned = 0;
    let endWeek = startWeek;
    while (assigned < needed) {
      if (!breakWeeks.has(cursor)) {
        assigned++;
        endWeek = cursor;
      }
      cursor++;
    }

    updated.push({ id: unit.id, start_week: startWeek, end_week: endWeek });
  }

  for (const u of updated) {
    await supabase.from('units').update({ start_week: u.start_week, end_week: u.end_week }).eq('id', u.id);
  }

  return { updated, warnings: [] };
}
