import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getCurriculumCalendar } from '@/app/src/lib/curriculumCalendar';
import { getCurriculumWeekFromDate } from '@/app/src/lib/routeParsing';
import type { SupabaseClient } from '@supabase/supabase-js';

const EVENT_TYPES = ['break', 'special_content', 'social_activity'] as const;
type EventType = (typeof EVENT_TYPES)[number];

function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('special_week_events')
    .select('id, grade_ids, lesson_id, curriculum_week, event_type, title, subtitle, content_html, is_active, priority, start_date, end_date, lessons(name)')
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('curriculum_week', { ascending: true })
    .order('priority', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id: number; grade_ids: number[] | null; lesson_id: number | null; curriculum_week: number | null;
    event_type: EventType; title: string; subtitle: string | null; content_html: string | null;
    is_active: boolean; priority: number; start_date: string | null; end_date: string | null;
    lessons: { name: string } | null;
  };
  const items = ((data as unknown as Row[] | null) || []).map((r) => ({
    id: r.id,
    gradeIds: r.grade_ids && r.grade_ids.length ? r.grade_ids : null,
    lessonId: r.lesson_id,
    lessonName: r.lessons?.name ?? null,
    curriculumWeek: r.curriculum_week,
    eventType: r.event_type,
    title: r.title,
    subtitle: r.subtitle,
    contentHtml: r.content_html,
    isActive: r.is_active,
    priority: r.priority,
    startDate: r.start_date,
    endDate: r.end_date,
  }));

  return NextResponse.json({ items });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Tüm türler artık gerçek takvim tarihiyle giriliyor — admin hafta numarasını ezbere
// hesaplamak zorunda kalmasın diye (bkz. routeParsing.ts:getCurriculumWeekFromDate).
// 'break' (tatil): sadece tarih aralığı saklanır, curriculum_week hep null kalır — o
// dönemde zaten hiçbir öğretim haftası yok. 'special_content'/'social_activity': girilen
// başlangıç tarihinden hangi öğretim haftasına denk geldiği burada, sunucu tarafında
// hesaplanıp curriculum_week'e yazılır (tek doğru kaynak sunucu olsun diye).
async function parseEventPayload(body: Record<string, unknown> | null, supabase: SupabaseClient) {
  if (!body) return { error: 'Geçersiz istek' as const };

  if (!isEventType(body.eventType)) {
    return { error: 'Geçersiz tür' as const };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return { error: 'Başlık zorunlu' as const };
  }

  let gradeIds: number[] | null = null;
  if (Array.isArray(body.gradeIds) && body.gradeIds.length) {
    gradeIds = body.gradeIds.map((v) => Number(v));
    if (gradeIds.some((v) => !Number.isFinite(v))) return { error: 'Geçersiz sınıf' as const };
  }

  const lessonId = body.lessonId === null || body.lessonId === undefined || body.lessonId === '' ? null : Number(body.lessonId);
  if (lessonId !== null && !Number.isFinite(lessonId)) return { error: 'Geçersiz ders' as const };

  const subtitle = typeof body.subtitle === 'string' && body.subtitle.trim() ? body.subtitle.trim() : null;
  const contentHtml = typeof body.contentHtml === 'string' && body.contentHtml.trim() ? body.contentHtml.trim() : null;
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
  const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;

  const startDate = typeof body.startDate === 'string' ? body.startDate : '';
  const endDate = typeof body.endDate === 'string' && body.endDate ? body.endDate : startDate;
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { error: 'Başlangıç (ve varsa bitiş) tarihi (YYYY-MM-DD) zorunlu' as const };
  }
  if (endDate < startDate) {
    return { error: 'Bitiş tarihi başlangıçtan önce olamaz' as const };
  }

  let curriculumWeek: number | null = null;
  if (body.eventType !== 'break') {
    const { termStartDate, breaks } = await getCurriculumCalendar(supabase);
    curriculumWeek = getCurriculumWeekFromDate(startDate, 52, termStartDate, breaks);
    if (curriculumWeek == null) {
      return { error: 'Bu tarih için öğretim haftası hesaplanamadı — bir tatile denk geliyor olabilir ya da dönem henüz başlamamış' as const };
    }
  }

  return {
    value: {
      curriculum_week: curriculumWeek,
      event_type: body.eventType,
      title,
      subtitle,
      content_html: contentHtml,
      grade_ids: gradeIds,
      lesson_id: lessonId,
      is_active: isActive,
      priority,
      start_date: startDate,
      end_date: endDate,
    },
  };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const supabase = createServiceClient();
  const parsed = await parseEventPayload(body, supabase);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabase
    .from('special_week_events')
    .insert({ ...parsed.value, created_by: admin.user.id })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as (Record<string, unknown> & { id?: unknown }) | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const supabase = createServiceClient();
  const parsed = await parseEventPayload(body, supabase);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { error } = await supabase
    .from('special_week_events')
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const id = Number(request.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from('special_week_events').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
