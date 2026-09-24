import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { deleteUnitsCascade } from '@/app/src/lib/adminCascade';
import { getQuestionCountsByUnitId } from '@/app/src/lib/questionCounts';
import { revalidateUnitPages, revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';
import { slugify } from '@/app/src/lib/yillikPlan/importer';

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

// Konu Yönetimi panelinden ("+ Yeni Ünite") — TYMM toplu aktarım akışının aksine bu
// admin'in bilinçli, tek tek yaptığı manuel bir işlem, bu yüzden is_active:false ile
// incelemeye düşürmüyoruz; doğrudan yayında oluşturuyoruz.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { lessonId?: unknown; gradeId?: unknown; title?: unknown } | null;
  const lessonId = typeof body?.lessonId === 'number' ? body.lessonId : Number(body?.lessonId);
  const gradeId = typeof body?.gradeId === 'number' ? body.gradeId : Number(body?.gradeId);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';

  if (!Number.isInteger(lessonId) || !Number.isInteger(gradeId) || !title) {
    return NextResponse.json({ ok: false, error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // lesson_grades bağlantısı yoksa oluştur — bkz. tymm/importUnit.ts:saveTymmUnit'teki
  // aynı kontrol.
  const { data: lgData } = await supabase
    .from('lesson_grades')
    .select('lesson_id')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();
  if (!lgData) {
    await supabase.from('lesson_grades').insert({ lesson_id: lessonId, grade_id: gradeId, is_active: true });
  }

  // Slug çakışması olursa -2, -3... ekleyerek benzersizleştir (units.slug üzerinde artık
  // unique constraint yok ama aynı ders/sınıfta iki farklı ünitenin aynı slug'ı paylaşması
  // public URL çözümlemesini belirsizleştirir).
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let suffix = 2;
  for (;;) {
    const { data: clash } = await supabase
      .from('units')
      .select('id')
      .eq('lesson_id', lessonId)
      .eq('grade_id', gradeId)
      .eq('slug', slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data: maxOrderData } = await supabase
    .from('units')
    .select('order_no')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .order('order_no', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxOrderData as { order_no: number } | null)?.order_no ?? 0) + 1;

  const { data: created, error } = await supabase
    .from('units')
    .insert({ lesson_id: lessonId, grade_id: gradeId, title, slug, order_no: nextOrder, is_active: true })
    .select('id, lesson_id, grade_id, title, slug, description, order_no, is_active, start_week, end_week, curriculum_code, duration_hours')
    .single();
  if (error || !created) return NextResponse.json({ ok: false, error: error?.message || 'Ünite oluşturulamadı' }, { status: 500 });

  // Yeni ünite is_active:true olarak oluşturuluyor ama /[gradeSlug]/[lessonSlug] sayfası
  // ISR ile 1 saat cache'leniyor (bkz. page.tsx revalidate=3600) — bu çağrı olmazsa admin
  // üniteyi ekler eklemez public sayfada "henüz ünite bulunamadı" görmeye devam eder, ta ki
  // biri o sayfayı başka bir yoldan (ör. is_active PATCH) revalidate edene ya da 1 saat
  // geçene kadar (kullanıcının 2026-09-24 canlıda yakaladığı gerçek örnek).
  await revalidateUnitPages(supabase, [(created as { id: number }).id]);

  return NextResponse.json({ ok: true, unit: created });
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

  // is_active/start_week/end_week dahil — bunlar o ünitedeki TÜM konu sayfalarının
  // görünürlüğünü/hafta hesabını etkiler.
  await revalidateUnitPages(supabase, ids);
  if (Object.prototype.hasOwnProperty.call(patch, 'is_active')) revalidateHomepage();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null) as { ids?: unknown; hard?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v): v is number => typeof v === 'number') : [];
  if (!ids.length) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });

  const supabase = createServiceClient();

  // Silinmeden ÖNCE (hard delete'te satırlar gidebileceği için) cache'i düşürüyoruz.
  await revalidateUnitPages(supabase, ids);
  revalidateHomepage();

  if (body?.hard === true) {
    const result = await deleteUnitsCascade(supabase, ids);
    return NextResponse.json(result);
  }

  const { error } = await supabase.from('units').update({ is_active: false }).in('id', ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ deletedIds: ids, failed: [] });
}
