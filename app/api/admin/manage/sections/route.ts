import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteSectionsCascade } from '@/app/src/lib/adminCascade';
import { revalidateTopicPagesBySectionIds } from '@/app/src/lib/topicPageRevalidation';

const EDITABLE_FIELDS = ['heading', 'body_markdown', 'status', 'order_no', 'image_url', 'image_prompt'] as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const topicId = request.nextUrl.searchParams.get('topicId');
  const status = request.nextUrl.searchParams.get('status');

  if (!topicId) {
    return NextResponse.json({ items: [] });
  }

  const { data: topicContent } = await supabase
    .from('topic_contents')
    .select('id')
    .eq('topic_id', topicId)
    .maybeSingle();

  const topicContentId = (topicContent as { id: number } | null)?.id;
  if (!topicContentId) {
    return NextResponse.json({ items: [] });
  }

  let query = supabase
    .from('topic_content_sections')
    .select('id, topic_content_id, order_no, heading, body_markdown, image_url, image_prompt, status')
    .eq('topic_content_id', topicContentId)
    .order('order_no', { ascending: true });

  if (status) query = query.eq('status', status);

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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of EDITABLE_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('topic_content_sections').update(patch).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await revalidateTopicPagesBySectionIds(supabase, ids);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();
  await revalidateTopicPagesBySectionIds(supabase, ids);
  const result = await deleteSectionsCascade(supabase, ids);
  return NextResponse.json(result);
}
