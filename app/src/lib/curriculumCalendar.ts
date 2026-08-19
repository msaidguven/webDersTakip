import type { SupabaseClient } from '@supabase/supabase-js';

type CalendarSettingsRow = { term_start_date: string };

// Admin /admin/takvim sayfasından ayarlanan, eğitim-öğretim yılının 1. haftasının
// Pazartesi tarihini döner. Ayar hiç girilmemişse null döner — çağıran taraf
// (getCurrentCurriculumWeek/getWeekDateRange) bu durumda eski sabit varsayıma düşer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCurriculumTermStartDate(supabase: SupabaseClient<any, any, any>): Promise<string | null> {
  const { data } = await supabase
    .from('curriculum_calendar_settings')
    .select('term_start_date')
    .eq('id', 1)
    .maybeSingle();
  return (data as CalendarSettingsRow | null)?.term_start_date ?? null;
}
