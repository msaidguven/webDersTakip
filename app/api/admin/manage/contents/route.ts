import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteTopicContentsCascade } from '@/app/src/lib/adminCascade';
import { revalidateTopicPagesByContentIds } from '@/app/src/lib/topicPageRevalidation';

const EDITABLE_FIELDS = ['title', 'subtitle', 'body_markdown', 'is_published', 'hero_image_url'] as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const topicId = request.nextUrl.searchParams.get('topicId');
  const unitId = request.nextUrl.searchParams.get('unitId');
  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const search = request.nextUrl.searchParams.get('search');
  const source = request.nextUrl.searchParams.get('source');
  const isPublished = request.nextUrl.searchParams.get('isPublished');

  let unitIds: number[] | null = null;
  if (!topicId && !unitId && (gradeId || lessonId)) {
    let unitQuery = supabase.from('units').select('id');
    if (gradeId) unitQuery = unitQuery.eq('grade_id', gradeId);
    if (lessonId) unitQuery = unitQuery.eq('lesson_id', lessonId);
    const { data: unitRows } = await unitQuery;
    unitIds = ((unitRows as { id: number }[] | null) || []).map((r) => r.id);
    if (!unitIds.length) return NextResponse.json({ items: [] });
  }

  let topicIds: number[] | null = null;
  if (!topicId && (unitId || unitIds)) {
    let topicQuery = supabase.from('topics').select('id');
    if (unitId) topicQuery = topicQuery.eq('unit_id', unitId);
    else if (unitIds) topicQuery = topicQuery.in('unit_id', unitIds);
    const { data: topicRows } = await topicQuery;
    topicIds = ((topicRows as { id: number }[] | null) || []).map((r) => r.id);
    if (!topicIds.length) return NextResponse.json({ items: [] });
  }

  let query = supabase
    .from('topic_contents')
    .select('id, topic_id, title, subtitle, body_markdown, is_published, hero_image_url, version_no, source, created_at, topics(title)')
    .order('created_at', { ascending: false })
    .limit(300);

  if (topicId) query = query.eq('topic_id', topicId);
  else if (topicIds) query = query.in('topic_id', topicIds);
  if (search) query = query.ilike('title', `%${search}%`);
  if (source) query = query.eq('source', source);
  if (isPublished) query = query.eq('is_published', isPublished === 'true');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data || [] });
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
  const { error } = await supabase.from('topic_contents').update(patch).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await revalidateTopicPagesByContentIds(supabase, ids);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  // Silinmeden ÖNCE topic'leri çözüp cache'i düşürüyoruz — satırlar gittikten sonra
  // content->topic zinciri kurulamaz.
  await revalidateTopicPagesByContentIds(supabase, ids);
  const result = await deleteTopicContentsCascade(supabase, ids);
  return NextResponse.json(result);
}
