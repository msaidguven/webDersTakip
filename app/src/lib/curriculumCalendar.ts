import type { SupabaseClient } from '@supabase/supabase-js';
import type { CurriculumBreak } from '@/app/src/lib/routeParsing';

type CalendarSettingsRow = { term_start_date: string; term_end_date: string | null };
type BreakRow = { start_date: string | null; end_date: string | null };

export type CurriculumCalendar = { termStartDate: string | null; termEndDate: string | null; breaks: CurriculumBreak[] };

// Admin /admin/takvim sayfasından ayarlanan (1) eğitim-öğretim yılının 1. haftasının
// Pazartesi tarihini, (2) bitiş tarihini ve (3) tarih aralığı girilmiş tatilleri
// (special_week_events, event_type='break') döner. getCurrentCurriculumWeek/getWeekDateRange
// (1) ve (3)'ü birlikte kullanarak hafta numarasını gerçek takvim tarihine çevirir;
// calendarWeeksBetween (1) ve (2)'yi kullanarak Kazanımlar modalinin toplam takvim haftası
// sayısını hesaplar. Ayar hiç girilmemişse ilgili alan null döner ve çağıran taraf eski
// sabit varsayıma (veya ünite bazlı tahmine) düşer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCurriculumCalendar(supabase: SupabaseClient<any, any, any>): Promise<CurriculumCalendar> {
  const [{ data: settingsData }, { data: breaksData }] = await Promise.all([
    supabase.from('curriculum_calendar_settings').select('term_start_date, term_end_date').eq('id', 1).maybeSingle(),
    supabase
      .from('special_week_events')
      .select('start_date, end_date')
      .eq('event_type', 'break')
      .eq('is_active', true)
      .not('start_date', 'is', null)
      .not('end_date', 'is', null),
  ]);

  const settings = settingsData as CalendarSettingsRow | null;
  const termStartDate = settings?.term_start_date ?? null;
  const termEndDate = settings?.term_end_date ?? null;
  const breaks = ((breaksData as BreakRow[] | null) || [])
    .filter((b): b is { start_date: string; end_date: string } => !!b.start_date && !!b.end_date)
    .map((b) => ({ startDate: b.start_date, endDate: b.end_date }));

  return { termStartDate, termEndDate, breaks };
}
