import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/src/lib/adminAuth';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { revalidateHomepage, revalidateGradeLessonPage } from '@/app/src/lib/topicPageRevalidation';
import { slugify } from '@/app/src/lib/yillikPlan/importer';

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
    .select('lesson_id, grade_id, weekly_hours, is_active, tymm_page_url, tymm_verified')
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    lessonId?: unknown;
    gradeId?: unknown;
    weeklyHours?: unknown;
    isActive?: unknown;
    tymmPageUrl?: unknown;
    tymmVerified?: unknown;
  } | null;
  const lessonId = Number(body?.lessonId);
  const gradeId = Number(body?.gradeId);

  if (!Number.isFinite(lessonId) || !Number.isFinite(gradeId)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body && Object.prototype.hasOwnProperty.call(body, 'weeklyHours')) {
    const weeklyHoursRaw = body.weeklyHours;
    const weeklyHours = weeklyHoursRaw === null ? null : Number(weeklyHoursRaw);
    if (weeklyHours !== null && (!Number.isFinite(weeklyHours) || weeklyHours < 1)) {
      return NextResponse.json({ error: 'Haftalık saat pozitif bir sayı olmalı' }, { status: 400 });
    }
    update.weekly_hours = weeklyHours;
  }

  if (typeof body?.isActive === 'boolean') {
    update.is_active = body.isActive;
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'tymmPageUrl')) {
    const tymmPageUrl = body.tymmPageUrl;
    if (tymmPageUrl !== null && typeof tymmPageUrl !== 'string') {
      return NextResponse.json({ error: 'Geçersiz TYMM URL' }, { status: 400 });
    }
    update.tymm_page_url = tymmPageUrl === null ? null : tymmPageUrl.trim() || null;
  }

  if (typeof body?.tymmVerified === 'boolean') {
    update.tymm_verified = body.tymmVerified;
  }

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('lesson_grades').update(update).eq('lesson_id', lessonId).eq('grade_id', gradeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // isActive dahilse ana sayfadaki ders kartları/sayaçlar VE bu sınıf+dersin kendi
  // sayfaları (/[gradeSlug], /[gradeSlug]/[lessonSlug]) da değişir (bkz. topic
  // sayfalarında olduğu gibi burada tüm üniteleri tek tek revalidate etmiyoruz —
  // bu nadir/geniş etkili bir işlem, konu sayfaları saatlik fallback'e bırakıldı;
  // ama tek bir sınıf+ders çiftinin sayfalarını invalide etmek ucuz olduğu için
  // onu yine de yapıyoruz).
  if (Object.prototype.hasOwnProperty.call(update, 'is_active')) {
    revalidateHomepage();
    void revalidateGradeLessonPage(supabase, gradeId, lessonId);
  }
  return NextResponse.json({ ok: true });
}

// Sınıfa ders bağlar. Ya mevcut bir ders (lessonId) ya da yeni ders adı (newLessonName)
// gelir; yeni ders önce lessons'a eklenir. Bağlantı TASLAK (is_active=false) açılır —
// içeriği olmayan bir ders yayına boş sayfa olarak düşmesin, yayına alma Yayın
// Yönetimi'ndeki anahtardan yapılır.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = (await request.json().catch(() => null)) as {
    lessonId?: unknown;
    gradeId?: unknown;
    newLessonName?: unknown;
  } | null;
  const gradeId = Number(body?.gradeId);
  if (!Number.isInteger(gradeId) || gradeId <= 0) {
    return NextResponse.json({ error: 'Geçersiz sınıf' }, { status: 400 });
  }

  const supabase = createServiceClient();
  let lessonId: number;

  if (typeof body?.newLessonName === 'string') {
    const name = body.newLessonName.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: 'Ders adı 2-80 karakter olmalı' }, { status: 400 });
    }
    const slug = slugify(name);
    if (!slug) return NextResponse.json({ error: 'Ders adından geçerli bir adres üretilemedi' }, { status: 400 });

    // Ders tablosu küçük (sınıf başına bir avuç); tamamını çekip JS'te karşılaştırmak
    // PostgREST or() filtresinde "T.C." gibi noktalı adları kaçışlamaktan daha güvenli.
    const { data: allLessons, error: lessonsError } = await supabase.from('lessons').select('id, name, slug, order_no');
    if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 });
    const lessonRows =
      (allLessons as
        | {
            id: number;
            name: string;
            slug: string | null;
            order_no: number | null;
          }[]
        | null) || [];
    const nameKey = name.toLocaleLowerCase('tr');
    const existing = lessonRows.find((l) => l.slug === slug || l.name.toLocaleLowerCase('tr') === nameKey);
    if (existing) {
      return NextResponse.json({ error: `"${existing.name}" dersi zaten var, listeden seçin` }, { status: 409 });
    }

    const maxOrder = lessonRows.reduce((m, l) => Math.max(m, l.order_no ?? 0), 0);
    const { data: created, error: createError } = await supabase
      .from('lessons')
      .insert({ name, slug, order_no: maxOrder + 1, is_active: true })
      .select('id')
      .single();
    if (createError || !created) return NextResponse.json({ error: createError?.message || 'Ders oluşturulamadı' }, { status: 500 });
    lessonId = created.id;
  } else {
    lessonId = Number(body?.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return NextResponse.json({ error: 'Geçersiz ders' }, { status: 400 });
    }
  }

  const { error } = await supabase.from('lesson_grades').insert({ lesson_id: lessonId, grade_id: gradeId, is_active: false });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Bu ders bu sınıfta zaten var' }, { status: 409 });
    if (error.code === '23503') return NextResponse.json({ error: 'Ders veya sınıf bulunamadı' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lessonId });
}

// Dersi sınıftan kaldırır (yalnız lesson_grades bağlantısı; lessons satırı diğer
// sınıflarda kullanılıyor olabilir). Bu sınıf+derste ünite varsa reddedilir: içerik
// silmek geri dönüşsüz ve soru/oturum zincirini etkiler, o iş Toplu Sil'de kalır.
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const lessonId = Number(request.nextUrl.searchParams.get('lessonId'));
  const gradeId = Number(request.nextUrl.searchParams.get('gradeId'));
  if (!Number.isInteger(lessonId) || !Number.isInteger(gradeId) || lessonId <= 0 || gradeId <= 0) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { count, error: countError } = await supabase
    .from('units')
    .select('id', { count: 'exact', head: true })
    .eq('lesson_id', lessonId)
    .eq('grade_id', gradeId);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (count) {
    return NextResponse.json(
      {
        error: `Bu derste ${count} ünite var. Önce Toplu Sil'den üniteleri silin, sonra dersi kaldırın.`,
      },
      { status: 409 }
    );
  }

  const { error } = await supabase.from('lesson_grades').delete().eq('lesson_id', lessonId).eq('grade_id', gradeId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateHomepage();
  void revalidateGradeLessonPage(supabase, gradeId, lessonId);
  return NextResponse.json({ ok: true });
}
