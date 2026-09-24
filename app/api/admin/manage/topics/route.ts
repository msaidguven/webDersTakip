import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteTopicsCascade } from '@/app/src/lib/adminCascade';
import { getQuestionCountsByTopicId } from '@/app/src/lib/questionCounts';
import { revalidateUnitPagesForTopics, revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';
import { slugify } from '@/app/src/lib/yillikPlan/importer';

const EDITABLE_FIELDS = ['title', 'subtitle', 'order_no', 'curriculum_code', 'icon', 'is_active', 'is_archived'] as const;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();
  const unitId = request.nextUrl.searchParams.get('unitId');
  const lessonId = request.nextUrl.searchParams.get('lessonId');
  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const search = request.nextUrl.searchParams.get('search');
  const isActive = request.nextUrl.searchParams.get('isActive');
  const isArchived = request.nextUrl.searchParams.get('isArchived');

  let unitIds: number[] | null = null;
  if (!unitId && (lessonId || gradeId)) {
    let unitQuery = supabase.from('units').select('id');
    if (lessonId) unitQuery = unitQuery.eq('lesson_id', lessonId);
    if (gradeId) unitQuery = unitQuery.eq('grade_id', gradeId);
    const { data: unitRows } = await unitQuery;
    unitIds = ((unitRows as { id: number }[] | null) || []).map((r) => r.id);
    if (!unitIds.length) return NextResponse.json({ items: [] });
  }

  let query = supabase
    .from('topics')
    .select('id, unit_id, title, subtitle, slug, order_no, is_active, is_archived, curriculum_code, icon, units(title)')
    .order('unit_id', { ascending: true })
    .order('order_no', { ascending: true })
    .limit(500);

  if (unitId) query = query.eq('unit_id', unitId);
  else if (unitIds) query = query.in('unit_id', unitIds);
  if (search) query = query.ilike('title', `%${search}%`);
  if (isActive) query = query.eq('is_active', isActive === 'true');
  if (isArchived) query = query.eq('is_archived', isArchived === 'true');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const topics = data || [];
  const questionCountByTopic = await getQuestionCountsByTopicId(supabase, topics.map((t) => t.id));
  const items = topics.map((t) => ({ ...t, question_count: questionCountByTopic.get(t.id) ?? 0 }));

  return NextResponse.json({ items });
}

// Konu Yönetimi panelinden ("+ Yeni Konu") — bkz. units/route.ts POST'taki aynı gerekçe:
// admin'in bilinçli tek tek işlemi, doğrudan yayında oluşturuluyor.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { unitId?: unknown; title?: unknown } | null;
  const unitId = typeof body?.unitId === 'number' ? body.unitId : Number(body?.unitId);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';

  if (!Number.isInteger(unitId) || !title) {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // unit_id + slug birlikte unique (topics_unit_slug_unique) — çakışırsa -2, -3... ekle.
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 2;
  for (;;) {
    const { data: clash } = await supabase.from('topics').select('id').eq('unit_id', unitId).eq('slug', slug).maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data: maxOrderData } = await supabase
    .from('topics')
    .select('order_no')
    .eq('unit_id', unitId)
    .order('order_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxOrderData as { order_no: number } | null)?.order_no ?? 0) + 1;

  const { data: created, error } = await supabase
    .from('topics')
    .insert({ unit_id: unitId, title, slug, order_no: nextOrder, is_active: true })
    .select('id, unit_id, title, subtitle, slug, order_no, is_active, is_archived, curriculum_code, icon')
    .single();
  if (error || !created) return NextResponse.json({ ok: false, error: error?.message || 'Konu oluşturulamadı' }, { status: 500 });

  return NextResponse.json({ ok: true, topic: created });
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
  const { error } = await supabase.from('topics').update(patch).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // is_active/is_archived dahil — bir konunun görünürlüğü değişince o ünitedeki TÜM konu
  // sayfalarının sidebar listesi de değişir, sadece kendi sayfası değil.
  await revalidateUnitPagesForTopics(supabase, ids);
  if (
    Object.prototype.hasOwnProperty.call(patch, 'is_active') ||
    Object.prototype.hasOwnProperty.call(patch, 'is_archived')
  ) {
    revalidateHomepage();
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown; hard?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();

  // Silinmeden ÖNCE üniteyi çözüp cache'i düşürüyoruz — hard delete'te satırlar
  // gittikten sonra topic->unit zinciri kurulamaz.
  await revalidateUnitPagesForTopics(supabase, ids);
  revalidateHomepage();

  if (body?.hard === true) {
    const result = await deleteTopicsCascade(supabase, ids);
    return NextResponse.json(result);
  }

  const { error } = await supabase.from('topics').update({ is_active: false }).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deletedIds: ids, failed: [] });
}
