import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateHomepage } from '@/app/src/lib/topicPageRevalidation';
import { slugify } from '@/app/src/lib/yillikPlan/importer';

type GradeRow = {
  id: number;
  name: string;
  order_no: number;
  is_active: boolean;
  slug: string | null;
};

type LessonRow = {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
  order_no: number | null;
  is_active: boolean;
  slug: string | null;
};

type LessonGradeRow = {
  lesson_id: number;
  grade_id: number;
  is_active: boolean;
  weekly_hours: number | null;
  tymm_page_url: string | null;
  tymm_verified: boolean | null;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const supabase = createServiceClient();

  const [gradesRes, lessonsRes, lgRes, unitsRes, teachersRes] = await Promise.all([
    supabase.from('grades').select('id, name, order_no, is_active, slug').order('order_no'),
    supabase.from('lessons').select('id, name, icon, description, order_no, is_active, slug').order('order_no').order('id'),
    supabase.from('lesson_grades').select('lesson_id, grade_id, is_active, weekly_hours, tymm_page_url, tymm_verified'),
    supabase.from('units').select('grade_id, lesson_id'),
    supabase.from('teacher_lessons').select('lesson_id'),
  ]);

  if (gradesRes.error) return NextResponse.json({ error: gradesRes.error.message }, { status: 500 });
  if (lessonsRes.error) return NextResponse.json({ error: lessonsRes.error.message }, { status: 500 });
  if (lgRes.error) return NextResponse.json({ error: lgRes.error.message }, { status: 500 });
  if (unitsRes.error) return NextResponse.json({ error: unitsRes.error.message }, { status: 500 });
  if (teachersRes.error) return NextResponse.json({ error: teachersRes.error.message }, { status: 500 });

  const unitCountByPair = new Map<string, number>();
  const unitCountByLesson = new Map<number, number>();
  for (const u of (unitsRes.data as { grade_id: number | null; lesson_id: number | null }[] | null) || []) {
    if (u.grade_id != null && u.lesson_id != null) {
      const key = `${u.grade_id}:${u.lesson_id}`;
      unitCountByPair.set(key, (unitCountByPair.get(key) ?? 0) + 1);
    }
    if (u.lesson_id != null) {
      unitCountByLesson.set(u.lesson_id, (unitCountByLesson.get(u.lesson_id) ?? 0) + 1);
    }
  }

  const teacherCountByLesson = new Map<number, number>();
  for (const t of (teachersRes.data as { lesson_id: number | null }[] | null) || []) {
    if (t.lesson_id != null) {
      teacherCountByLesson.set(t.lesson_id, (teacherCountByLesson.get(t.lesson_id) ?? 0) + 1);
    }
  }

  const assignedGradeCountByLesson = new Map<number, number>();
  const lessonGrades = ((lgRes.data as LessonGradeRow[] | null) || []).map((lg) => {
    assignedGradeCountByLesson.set(lg.lesson_id, (assignedGradeCountByLesson.get(lg.lesson_id) ?? 0) + 1);
    return {
      lessonId: lg.lesson_id,
      gradeId: lg.grade_id,
      isActive: lg.is_active,
      weeklyHours: lg.weekly_hours,
      tymmPageUrl: lg.tymm_page_url,
      tymmVerified: Boolean(lg.tymm_verified),
      unitCount: unitCountByPair.get(`${lg.grade_id}:${lg.lesson_id}`) ?? 0,
    };
  });

  const grades = ((gradesRes.data as GradeRow[] | null) || []).map((g) => ({
    id: g.id,
    name: g.name,
    orderNo: g.order_no,
    isActive: g.is_active,
    slug: g.slug,
  }));

  const lessons = ((lessonsRes.data as LessonRow[] | null) || []).map((l) => ({
    id: l.id,
    name: l.name,
    icon: l.icon,
    description: l.description,
    orderNo: l.order_no ?? 0,
    isActive: l.is_active,
    slug: l.slug,
    assignedGradeCount: assignedGradeCountByLesson.get(l.id) ?? 0,
    totalUnitCount: unitCountByLesson.get(l.id) ?? 0,
    teacherCount: teacherCountByLesson.get(l.id) ?? 0,
  }));

  return NextResponse.json({ grades, lessons, lessonGrades });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    slug?: unknown;
    icon?: unknown;
    description?: unknown;
    orderNo?: unknown;
    isActive?: unknown;
    gradeIds?: unknown;
    weeklyHours?: unknown;
  } | null;

  if (typeof body?.name !== 'string') {
    return NextResponse.json({ error: 'Ders adı zorunlu' }, { status: 400 });
  }
  const name = body.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Ders adı 2-80 karakter olmalı' }, { status: 400 });
  }

  const rawSlug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : name;
  const slug = slugify(rawSlug);
  if (!slug) {
    return NextResponse.json({ error: 'Geçerli bir slug üretilemedi' }, { status: 400 });
  }

  const icon = typeof body.icon === 'string' ? body.icon.trim() || null : null;
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;

  let weeklyHours: number | null = null;
  if (body.weeklyHours !== undefined && body.weeklyHours !== null && body.weeklyHours !== '') {
    const parsed = Number(body.weeklyHours);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 40) {
      return NextResponse.json({ error: 'Haftalık saat 1-40 arasında tam sayı olmalı' }, { status: 400 });
    }
    weeklyHours = parsed;
  }

  const gradeIds: number[] = Array.isArray(body.gradeIds)
    ? Array.from(new Set(body.gradeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)))
    : [];

  const supabase = createServiceClient();
  const { data: allLessons, error: listErr } = await supabase.from('lessons').select('id, name, slug, order_no');
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const existingRows = (allLessons as { id: number; name: string; slug: string | null; order_no: number | null }[] | null) || [];
  const nameKey = name.toLocaleLowerCase('tr');
  const dup = existingRows.find((l) => l.slug === slug || l.name.toLocaleLowerCase('tr') === nameKey);
  if (dup) {
    return NextResponse.json({ error: `"${dup.name}" dersi (veya aynı slug) zaten mevcut` }, { status: 409 });
  }

  const maxOrder = existingRows.reduce((m, l) => Math.max(m, l.order_no ?? 0), 0);
  const parsedOrder = body.orderNo !== undefined && body.orderNo !== null && body.orderNo !== '' ? Number(body.orderNo) : maxOrder + 1;
  const orderNo = Number.isInteger(parsedOrder) && parsedOrder >= 0 ? parsedOrder : maxOrder + 1;

  const { data: created, error: createErr } = await supabase
    .from('lessons')
    .insert({ name, slug, icon, description, order_no: orderNo, is_active: isActive })
    .select('id')
    .single();
  if (createErr || !created) {
    return NextResponse.json({ error: createErr?.message || 'Ders oluşturulamadı' }, { status: 500 });
  }

  if (gradeIds.length > 0) {
    const rows = gradeIds.map((gid) => ({
      lesson_id: created.id,
      grade_id: gid,
      is_active: false,
      ...(weeklyHours !== null ? { weekly_hours: weeklyHours } : {}),
    }));
    const { error: assignErr } = await supabase.from('lesson_grades').insert(rows);
    if (assignErr) {
      return NextResponse.json(
        { error: `Ders oluşturuldu ama sınıf atamasında hata: ${assignErr.message}`, lessonId: created.id },
        { status: 500 }
      );
    }
  }

  revalidateHomepage();
  return NextResponse.json({ ok: true, lessonId: created.id });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    name?: unknown;
    slug?: unknown;
    icon?: unknown;
    description?: unknown;
    orderNo?: unknown;
    isActive?: unknown;
  } | null;

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Geçersiz ders ID' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const update: Record<string, unknown> = {};

  if (typeof body?.name === 'string') {
    const name = body.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: 'Ders adı 2-80 karakter olmalı' }, { status: 400 });
    }
    update.name = name;
  }

  if (typeof body?.slug === 'string') {
    const slug = slugify(body.slug.trim());
    if (!slug) return NextResponse.json({ error: 'Geçerli bir slug girin' }, { status: 400 });
    update.slug = slug;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'icon')) {
    update.icon = typeof body.icon === 'string' ? body.icon.trim() || null : null;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'description')) {
    update.description = typeof body.description === 'string' ? body.description.trim() || null : null;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'orderNo')) {
    const parsed = Number(body.orderNo);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json({ error: 'Sıra no 0 veya pozitif tam sayı olmalı' }, { status: 400 });
    }
    update.order_no = parsed;
  }

  if (typeof body?.isActive === 'boolean') {
    update.is_active = body.isActive;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  if (update.name || update.slug) {
    const { data: allLessons, error: listErr } = await supabase.from('lessons').select('id, name, slug');
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    const rows = (allLessons as { id: number; name: string; slug: string | null }[] | null) || [];
    const nameKey = typeof update.name === 'string' ? update.name.toLocaleLowerCase('tr') : null;
    const dup = rows.find(
      (l) =>
        l.id !== id &&
        ((nameKey && l.name.toLocaleLowerCase('tr') === nameKey) || (update.slug && l.slug === update.slug))
    );
    if (dup) {
      return NextResponse.json({ error: `"${dup.name}" ile ad veya slug çakışması var` }, { status: 409 });
    }
  }

  const { error } = await supabase.from('lessons').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateHomepage();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));
  if (!Number.isInteger(lessonId) || lessonId <= 0) {
    return NextResponse.json({ error: 'Geçersiz ders ID' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const [lgRes, unitRes, teacherRes] = await Promise.all([
    supabase.from('lesson_grades').select('grade_id', { count: 'exact', head: true }).eq('lesson_id', lessonId),
    supabase.from('units').select('id', { count: 'exact', head: true }).eq('lesson_id', lessonId),
    supabase.from('teacher_lessons').select('teacher_id', { count: 'exact', head: true }).eq('lesson_id', lessonId),
  ]);

  if (lgRes.error) return NextResponse.json({ error: lgRes.error.message }, { status: 500 });
  if (unitRes.error) return NextResponse.json({ error: unitRes.error.message }, { status: 500 });
  if (teacherRes.error) return NextResponse.json({ error: teacherRes.error.message }, { status: 500 });

  const reasons: string[] = [];
  if (lgRes.count) reasons.push(`${lgRes.count} sınıfa atanmış`);
  if (unitRes.count) reasons.push(`${unitRes.count} ünitesi var`);
  if (teacherRes.count) reasons.push(`${teacherRes.count} öğretmen branşına bağlı`);

  if (reasons.length > 0) {
    return NextResponse.json(
      { error: `Bu ders silinemiyor çünkü ${reasons.join(', ')}. Önce bağlı kayıtları kaldırın.` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateHomepage();
  return NextResponse.json({ ok: true });
}
