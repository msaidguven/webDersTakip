import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getClientIp, checkAuthRateLimit, recordAuthAttempt, verifyBotChallenge } from '@/app/src/lib/authSecurity';

// Öğrenci kaydı öğretmen kaydıyla (app/api/ogretmen/register) aynı ilkeyi paylaşır: bot
// koruması ve rate limit sadece sunucuda geçerliyse işe yarar, bu yüzden auth.signUp da
// artık client'tan değil buradan (admin API ile) yapılıyor.
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
    gradeId?: unknown;
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
  const gradeId = typeof body.gradeId === 'number' && Number.isInteger(body.gradeId) ? body.gradeId : null;

  if (!email || password.length < 6 || !fullName) {
    await recordAuthAttempt(ip, 'register', false);
    return NextResponse.json({ error: 'E-posta, şifre (en az 6 karakter) ve ad soyad gerekli' }, { status: 400 });
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

  const { error: profileError } = await service
    .from('profiles')
    .insert({ id: created.user.id, full_name: fullName, role: 'student', grade_id: gradeId });

  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    await recordAuthAttempt(ip, 'register', false);
    return NextResponse.json({ error: 'Kayıt yapılamadı' }, { status: 500 });
  }

  await recordAuthAttempt(ip, 'register', true);

  // Eski akışta client-side signUp() kullanıcıyı doğrudan oturum açık bırakıyordu; burada
  // aynı deneyimi korumak için hesap sunucuda oluşturulduktan sonra aynı bilgilerle oturum
  // açılıp cookie'ler response'a yazılıyor. Proje e-posta onayı istiyorsa bu adım sessizce
  // başarısız olur — kullanıcı normal şekilde /login üzerinden giriş yapar.
  try {
    const cookieClient = await createClient();
    await cookieClient.auth.signInWithPassword({ email, password });
  } catch {
    // yoksay — hesap oluşturuldu, otomatik oturum açma zorunlu değil
  }

  return NextResponse.json({ ok: true });
}
