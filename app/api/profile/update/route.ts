import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';

const EDITABLE_FIELDS = ['full_name', 'username', 'avatar_url', 'grade_id', 'city_id', 'district_id', 'school_id', 'school_name'] as const;
const MAX_TEACHER_LESSONS = 10;

// profiles.username DB'de sadece UNIQUE, başka bir format kısıtı yok (bkz. db_schemas.sql).
// Liderlik tablosu ve yorumlar bu alanı gösteriyor (full_name yerine, gizlilik için — bkz.
// add_weekly_leaderboard_rpc.sql), bu yüzden burada makul bir kullanıcı adı formatı
// uygulama katmanında zorlanıyor: 3-20 karakter, küçük harf/rakam/alt çizgi.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

// /profil sayfası artık tamamen client-side render oluyor (bkz. ProfilClient.tsx) — sayfa
// kabuğu (Sidebar/TopBar) bekletilmeden hemen çizilsin diye kendi profilini okuma da
// buradan, mount sonrası fetch ile yapılıyor. profiles'ta kullanıcı bazlı SELECT RLS
// politikası olmadığından (PATCH'teki gibi) servis rolüyle okuyup uygulama katmanında
// yetkilendiriyoruz — auth.getUser() burada bir API route içinde çalıştığı için artık
// sayfanın ilk HTML'ini bloklamıyor.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profileRow } = await service
    .from('profiles')
    .select('full_name, username, avatar_url, grade_id, city_id, district_id, school_id, school_name, role, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  let gradeName: string | null = null;
  if (profileRow?.grade_id) {
    const { data: gradeRow } = await service
      .from('grades')
      .select('name')
      .eq('id', profileRow.grade_id)
      .maybeSingle();
    gradeName = (gradeRow as { name: string } | null)?.name || null;
  }

  return NextResponse.json({ profile: profileRow || null, gradeName });
}

// Kullanıcının kendi profilini güncellemesi için: oturumu doğrular, sadece kendi
// satırını (id = session user id) günceller. profiles tablosunda kullanıcı bazlı
// UPDATE RLS politikası olmadığından yetki kontrolünü burada, uygulama katmanında yapıyoruz.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { patch?: unknown } | null;
  const rawPatch = body?.patch && typeof body.patch === 'object' ? (body.patch as Record<string, unknown>) : null;
  if (!rawPatch) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in rawPatch) patch[key] = rawPatch[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  if ('username' in patch) {
    const raw = patch.username;
    if (raw === null) {
      // kullanıcı adını kaldırmasına izin veriliyor (leaderboard/yorumlarda 'Öğrenci' gösterilir)
    } else if (typeof raw !== 'string' || !USERNAME_PATTERN.test(raw)) {
      return NextResponse.json({ error: 'Kullanıcı adı 3-20 karakter olmalı, sadece küçük harf, rakam ve alt çizgi (_) içerebilir' }, { status: 400 });
    }
  }

  const service = createServiceClient();
  const { error } = await service.from('profiles').update(patch).eq('id', user.id);
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Bu kullanıcı adı zaten alınmış' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// OAuth (Google vb.) ile İLK kez giriş yapan kullanıcının profili role/sınıf/branş
// bilinmeden oluşturulur (bkz. app/auth/callback/route.ts, onboarding_completed:false) —
// bu kullanıcı /profil'e yönlendirilip burada öğrenci/öğretmen seçip sınıf/branşını
// tamamlar. `role` normal PATCH'teki EDITABLE_FIELDS'a BİLEREK dahil değil (herkesin
// kendi rolünü — ör. 'admin' — serbestçe değiştirebilmesini önlemek için) — bu ayrı,
// tek-seferlik tamamlama eylemi SADECE onboarding_completed:false olan bir profili
// student/teacher'a çevirebilir, başka bir role asla izin vermez.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Oturum gerekli' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { role?: unknown; gradeId?: unknown; lessonIds?: unknown } | null;
  const role = body?.role === 'teacher' ? 'teacher' : body?.role === 'student' ? 'student' : null;
  if (!role) {
    return NextResponse.json({ error: 'Öğrenci veya öğretmen seçmelisin' }, { status: 400 });
  }

  const service = createServiceClient();

  if (role === 'student') {
    const gradeId = typeof body?.gradeId === 'number' && Number.isInteger(body.gradeId) ? body.gradeId : null;
    if (!gradeId) {
      return NextResponse.json({ error: 'Sınıfını seçmelisin' }, { status: 400 });
    }
    const { error } = await service
      .from('profiles')
      .update({ role: 'student', grade_id: gradeId, onboarding_completed: true })
      .eq('id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const lessonIds = Array.isArray(body?.lessonIds)
      ? (body!.lessonIds as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
      : [];
    if (!lessonIds.length || lessonIds.length > MAX_TEACHER_LESSONS) {
      return NextResponse.json({ error: `1-${MAX_TEACHER_LESSONS} arası branş (ders) seçmelisin` }, { status: 400 });
    }
    // Öğretmen her zaman is_verified:false ile başlar — yönetici onayı gerekir (bkz.
    // app/src/lib/teacherAuth.ts, app/api/auth/register/route.ts'teki AYNI ilke).
    const { error: profileError } = await service
      .from('profiles')
      .update({ role: 'teacher', is_verified: false, onboarding_completed: true })
      .eq('id', user.id);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    const { error: lessonsError } = await service
      .from('teacher_lessons')
      .insert(lessonIds.map((lessonId) => ({ teacher_id: user.id, lesson_id: lessonId })));
    if (lessonsError) return NextResponse.json({ error: lessonsError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role });
}
