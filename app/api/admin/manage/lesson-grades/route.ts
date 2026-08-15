import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const gradeId = request.nextUrl.searchParams.get('gradeId');
  if (!lessonId || !gradeId) {
    return NextResponse.json({ error: 'lessonId ve gradeId zorunlu' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('lesson_grades')
    .select('lesson_id, grade_id, weekly_hours, question_count, is_active')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as { lessonId?: unknown; gradeId?: unknown; weeklyHours?: unknown } | null;
  const lessonId = Number(body?.lessonId);
  const gradeId = Number(body?.gradeId);
  const weeklyHoursRaw = body?.weeklyHours;
  const weeklyHours = weeklyHoursRaw === null ? null : Number(weeklyHoursRaw);

  if (!Number.isFinite(lessonId) || !Number.isFinite(gradeId)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }
  if (weeklyHours !== null && (!Number.isFinite(weeklyHours) || weeklyHours < 1)) {
    return NextResponse.json({ error: 'Haftalık saat pozitif bir sayı olmalı' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('lesson_grades')
    .update({ weekly_hours: weeklyHours })
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
