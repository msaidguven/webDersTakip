import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteTopicContentsCascade } from '@/app/src/lib/adminCascade';

const EDITABLE_FIELDS = ['title', 'subtitle', 'body_markdown', 'is_published', 'hero_image_url'] as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const topicId = request.nextUrl.searchParams.get('topicId');
  const unitId = request.nextUrl.searchParams.get('unitId');
  const search = request.nextUrl.searchParams.get('search');

  let topicIds: number[] | null = null;
  if (!topicId && unitId) {
    const { data: topicRows } = await supabase.from('topics').select('id').eq('unit_id', unitId);
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  const result = await deleteTopicContentsCascade(supabase, ids);
  return NextResponse.json(result);
}
