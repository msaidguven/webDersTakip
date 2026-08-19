import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { getWeekDateRange } from '@/app/src/lib/routeParsing';

type EventType = 'break' | 'special_content' | 'social_activity';
type Row = {
  id: number;
  event_type: EventType;
  title: string;
  subtitle: string | null;
  content_html: string | null;
  curriculum_week: number | null;
  start_date: string | null;
  end_date: string | null;
};

// Ders sayfasındaki Kazanımlar modali için: verilen sınıf+ders için geçerli, aktif özel
// haftaları (tatil/özel içerik/sosyal etkinlik) tarihleriyle döner. Herkese açık — /ders
// sayfası admin olmayan kullanıcılara da bu bilgiyi gösteriyor. start_date/end_date girilmemiş
// eski kayıtlar (curriculum_week'ten kalma) için tarih, o haftanın hesaplanan Pazartesi-Cuma
// aralığından türetilir — admin panelinde tarihe geçmemiş kayıtlar da böylece görünür kalır.
export async function GET(request: NextRequest) {
  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));
  if (!Number.isFinite(gradeId) || !Number.isFinite(lessonId)) {
    return NextResponse.json({ error: 'gradeId ve lessonId zorunlu' }, { status: 400 });
  }

  const supabase = await createClient();
  const { termStartDate, breaks } = await getCurriculumCalendar(supabase);

  const { data, error } = await supabase
    .from('special_week_events')
    .select('id, event_type, title, subtitle, content_html, curriculum_week, start_date, end_date')
    .eq('is_active', true)
    .or(`lesson_id.is.null,lesson_id.eq.${lessonId}`)
    .or(`grade_ids.is.null,grade_ids.cs.{${gradeId}}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = ((data as Row[] | null) || []).map((r) => {
    let startDate = r.start_date;
    let endDate = r.end_date;
    if (!startDate && r.curriculum_week != null) {
      const { start, end } = getWeekDateRange(r.curriculum_week, 52, termStartDate, breaks);
      startDate = start.toISOString().slice(0, 10);
      endDate = end.toISOString().slice(0, 10);
    }
    return {
      id: r.id,
      eventType: r.event_type,
      title: r.title,
      subtitle: r.subtitle,
      contentHtml: r.content_html,
      curriculumWeek: r.curriculum_week,
      startDate,
      endDate,
    };
  });

  return NextResponse.json({ items });
}
