import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getClientIp, checkAuthRateLimit, recordAuthAttempt, verifyBotChallenge } from '@/app/src/lib/authSecurity';

// Öğrenci VE öğretmen kaydı — ayrı bir "Öğretmen Girişi" sayfası kaldırıldı (kullanıcı
// isteği, 2026-09-12), tek form role'e göre dallanıyor. Bot koruması ve rate limit sadece
// sunucuda geçerliyse işe yarar, bu yüzden auth.signUp de artık client'tan değil buradan
// (admin API ile) yapılıyor — önceki öğretmen akışı client-side signUp() kullanıyordu ve
// hiç bot korumasından geçmiyordu, bu birleştirmeyle o boşluk da kapanmış oldu.
const MAX_TEACHER_LESSONS = 10;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const rateLimit = await checkAuthRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Çok fazla deneme yapıldı. Lütfen ${Math.ceil(rateLimit.retryAfterSeconds / 60)} dakika sonra tekrar deneyin.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null) as {
    email?: unknown;
    password?: unknown;
    fullName?: unknown;
    role?: unknown;
    gradeId?: unknown;
    lessonIds?: unknown;
    honeypot?: unknown;
    formRenderedAt?: unknown;
    mathA?: unknown;
    mathB?: unknown;
    mathAnswer?: unknown;
  } | null;

  if (!body || !verifyBotChallenge(body)) {
    await recordAuthAttempt(ip, 'register', false);
    return NextResponse.json({ error: 'Doğrulama başarısız. Lütfen sayfayı yenileyip tekrar deneyin.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const role = body.role === 'teacher' ? 'teacher' : 'student';
  const gradeId = typeof body.gradeId === 'number' && Number.isInteger(body.gradeId) ? body.gradeId : null;
  const lessonIds = Array.isArray(body.lessonIds)
    ? (body.lessonIds as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isInteger(v))
    : [];

  if (!email || password.length < 6 || !fullName) {
    await recordAuthAttempt(ip, 'register', false);
    return NextResponse.json({ error: 'E-posta, şifre (en az 6 karakter) ve ad soyad gerekli' }, { status: 400 });
  }
  if (role === 'student' && !gradeId) {
    await recordAuthAttempt(ip, 'register', false);
    return NextResponse.json({ error: 'Sınıfını seçmelisin' }, { status: 400 });
  }
  if (role === 'teacher' && (!lessonIds.length || lessonIds.length > MAX_TEACHER_LESSONS)) {
    await recordAuthAttempt(ip, 'register', false);
    return NextResponse.json({ error: `1-${MAX_TEACHER_LESSONS} arası branş (ders) seçmelisin` }, { status: 400 });
  }

  const service = createServiceClient();

  const { data: created, error: createError } = await service.auth.admin.createUser({ email, password });
  if (createError || !created.user) {
    await recordAuthAttempt(ip, 'register', false);
    const message = createError?.message?.toLowerCase().includes('already been registered')
      ? 'Bu e-posta adresi zaten kayıtlı'
      : 'Kayıt yapılamadı';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Öğretmen kaydı her zaman is_verified:false ile başlar (yönetici onayı gerekir) —
  // "role alanı kendi başına yeterli değil, herkes bunu seçebilir" ilkesi (bkz.
  // app/src/lib/teacherAuth.ts'teki aynı yorum). onboarding_completed:true — bu formu
  // dolduran zaten öğrenci/öğretmen seçimini burada tamamlamış oluyor (bkz. OAuth akışında
  // AYNI sütunun false başlayıp /profil'de tamamlanması, app/auth/callback/route.ts).
  const { error: profileError } = await service.from('profiles').insert(
    role === 'teacher'
      ? { id: created.user.id, full_name: fullName, role: 'teacher', is_verified: false, onboarding_completed: true }
      : { id: created.user.id, full_name: fullName, role: 'student', grade_id: gradeId, onboarding_completed: true }
  );

  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    await recordAuthAttempt(ip, 'register', false);
    return NextResponse.json({ error: 'Kayıt yapılamadı' }, { status: 500 });
  }

  if (role === 'teacher') {
    const { error: lessonsError } = await service
      .from('teacher_lessons')
      .insert(lessonIds.map((lessonId) => ({ teacher_id: created.user.id, lesson_id: lessonId })));
    if (lessonsError) {
      await service.auth.admin.deleteUser(created.user.id);
      await recordAuthAttempt(ip, 'register', false);
      return NextResponse.json({ error: 'Kayıt yapılamadı' }, { status: 500 });
    }
  }

  await recordAuthAttempt(ip, 'register', true);

  // Eski akışta client-side signUp() kullanıcıyı doğrudan oturum açık bırakıyordu; burada
  // aynı deneyimi korumak için hesap sunucuda oluşturulduktan sonra aynı bilgilerle oturum
  // açılıp access/refresh token'lar response'ta dönüyor. Client bunları kendi Supabase
  // instance'ına setSession() ile yükleyip cookie'leri KENDİSİ yazıyor — bunu server'da
  // (cookie-bound client ile) yapmak session'ı sunucu tarafında set eder ama tarayıcıdaki
  // Supabase client'ının (AuthContext'in dinlediği) belleğindeki oturumu GÜNCELLEMEZ; kullanıcı
  // sayfayı yenileyene kadar hâlâ "giriş yapmamış" görünür (bkz. kullanıcının 2026-09-05
  // bildirdiği bug). Proje e-posta onayı istiyorsa bu adım sessizce session'sız döner —
  // kullanıcı normal şekilde /login üzerinden giriş yapar.
  let session: { access_token: string; refresh_token: string } | null = null;
  try {
    const anon = createAnonClient();
    const { data: signInData } = await anon.auth.signInWithPassword({ email, password });
    if (signInData.session) {
      session = { access_token: signInData.session.access_token, refresh_token: signInData.session.refresh_token };
    }
  } catch {
    // yoksay — hesap oluşturuldu, otomatik oturum açma zorunlu değil
  }

  return NextResponse.json({ ok: true, session, role });
}
