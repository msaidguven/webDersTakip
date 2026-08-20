import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteOutcomesCascade } from '@/app/src/lib/adminCascade';

const EDITABLE_FIELDS = ['description', 'code', 'order_index'] as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const topicId = request.nextUrl.searchParams.get('topicId');
  const search = request.nextUrl.searchParams.get('search');

  if (!topicId && !search) {
    return NextResponse.json({ items: [] });
  }

  // order_index her konuda 1'den başlar (konuya özel); topicId verilmeden (search ile) birden
  // fazla konu döndüğünde SADECE order_index'e göre sıralamak farklı konuların kazanımlarını
  // birbirine karıştırır — önce topic_id'ye göre grupluyoruz ki her konunun kazanımları en
  // azından kendi içinde bir arada ve doğru sırada kalsın.
  let query = supabase
    .from('outcomes')
    .select('id, topic_id, description, order_index, code, topics(title)')
    .order('topic_id', { ascending: true })
    .order('order_index', { ascending: true })
    .limit(300);

  if (topicId) query = query.eq('topic_id', topicId);
  if (search) query = query.ilike('description', `%${search}%`);

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
  const { error } = await supabase.from('outcomes').update(patch).in('id', ids);
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
  const result = await deleteOutcomesCascade(supabase, ids);
  return NextResponse.json(result);
}
