import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

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
    .select('id, grade_id, lesson_id, curriculum_week, event_type, title, subtitle, content_html, is_active, priority, grades(name), lessons(name)')
    .order('curriculum_week', { ascending: true })
    .order('priority', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id: number; grade_id: number | null; lesson_id: number | null; curriculum_week: number;
    event_type: EventType; title: string; subtitle: string | null; content_html: string | null;
    is_active: boolean; priority: number;
    grades: { name: string } | null; lessons: { name: string } | null;
  };
  const items = ((data as unknown as Row[] | null) || []).map((r) => ({
    id: r.id,
    gradeId: r.grade_id,
    gradeName: r.grades?.name ?? null,
    lessonId: r.lesson_id,
    lessonName: r.lessons?.name ?? null,
    curriculumWeek: r.curriculum_week,
    eventType: r.event_type,
    title: r.title,
    subtitle: r.subtitle,
    contentHtml: r.content_html,
    isActive: r.is_active,
    priority: r.priority,
  }));

  return NextResponse.json({ items });
}

function parseEventPayload(body: Record<string, unknown> | null) {
  if (!body) return { error: 'Geçersiz istek' as const };

  const curriculumWeek = Number(body.curriculumWeek);
  if (!Number.isFinite(curriculumWeek) || curriculumWeek < 1 || curriculumWeek > 52) {
    return { error: 'Hafta 1-52 arasında olmalı' as const };
  }

  if (!isEventType(body.eventType)) {
    return { error: 'Geçersiz tür' as const };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return { error: 'Başlık zorunlu' as const };
  }

  const gradeId = body.gradeId === null || body.gradeId === undefined || body.gradeId === '' ? null : Number(body.gradeId);
  const lessonId = body.lessonId === null || body.lessonId === undefined || body.lessonId === '' ? null : Number(body.lessonId);
  if (gradeId !== null && !Number.isFinite(gradeId)) return { error: 'Geçersiz sınıf' as const };
  if (lessonId !== null && !Number.isFinite(lessonId)) return { error: 'Geçersiz ders' as const };

  const subtitle = typeof body.subtitle === 'string' && body.subtitle.trim() ? body.subtitle.trim() : null;
  const contentHtml = typeof body.contentHtml === 'string' && body.contentHtml.trim() ? body.contentHtml.trim() : null;
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
  const priority = Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0;

  return {
    value: {
      curriculum_week: curriculumWeek,
      event_type: body.eventType,
      title,
      subtitle,
      content_html: contentHtml,
      grade_id: gradeId,
      lesson_id: lessonId,
      is_active: isActive,
      priority,
    },
  };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseEventPayload(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createServiceClient();
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

  const parsed = parseEventPayload(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createServiceClient();
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
