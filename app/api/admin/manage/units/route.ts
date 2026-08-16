import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteUnitsCascade } from '@/app/src/lib/adminCascade';
import { getQuestionCountsByUnitId } from '@/app/src/lib/questionCounts';

const EDITABLE_FIELDS = ['title', 'description', 'order_no', 'start_week', 'end_week', 'is_active', 'duration_hours', 'curriculum_code'] as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const search = request.nextUrl.searchParams.get('search');
  const isActive = request.nextUrl.searchParams.get('isActive');

  let query = supabase
    .from('units')
    .select('id, lesson_id, grade_id, title, slug, description, order_no, is_active, start_week, end_week, curriculum_code, duration_hours, lessons(name)')
    .order('grade_id', { ascending: true })
    .order('order_no', { ascending: true })
    .limit(500);

  if (gradeId) query = query.eq('grade_id', gradeId);
  if (lessonId) query = query.eq('lesson_id', lessonId);
  if (search) query = query.ilike('title', `%${search}%`);
  if (isActive) query = query.eq('is_active', isActive === 'true');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const units = data || [];
  const questionCountByUnit = await getQuestionCountsByUnitId(supabase, units.map((u) => u.id));
  const items = units.map((u) => ({ ...u, question_count: questionCountByUnit.get(u.id) ?? 0 }));

  return NextResponse.json({ items });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown; patch?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  const rawPatch = body?.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : null;

  if (!ids.length || !rawPatch) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('units').update(patch).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown; hard?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();

  if (body?.hard === true) {
    const result = await deleteUnitsCascade(supabase, ids);
    return NextResponse.json(result);
  }

  const { error } = await supabase.from('units').update({ is_active: false }).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deletedIds: ids, failed: [] });
}
