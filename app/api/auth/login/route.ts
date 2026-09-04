import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { getClientIp, checkAuthRateLimit, recordAuthAttempt } from '@/app/src/lib/authSecurity';

// Login artık client'tan değil buradan yapılıyor — hem IP rate limit'i (aksi halde
// client doğrudan Supabase auth API'sini çağırıp bunu tamamen atlayabilirdi) hem de
// "şifre doğru ama hesap banlı" kontrolünü sunucuda, oturum tarayıcıya ulaşmadan
// önce uygulayabilmek için. Cookie-bound client YERİNE cookie'siz anon client
// kullanılıyor — session'ı burada cookie'ye yazmak, tarayıcıdaki Supabase client'ının
// (AuthContext'in dinlediği) belleğindeki oturumu güncellemiyor; bunun yerine
// access/refresh token'lar response'ta dönüyor, client bunları kendi instance'ına
// setSession() ile yükleyip cookie'leri KENDİSİ yazıyor (bkz. kullanıcının 2026-09-05
// bildirdiği "giriş yaptım ama sayfayı yenileyene kadar görünmüyor" bugu).
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const rateLimit = await checkAuthRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Çok fazla deneme yapıldı. Lütfen ${Math.ceil(rateLimit.retryAfterSeconds / 60)} dakika sonra tekrar deneyin.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    await recordAuthAttempt(ip, 'login', false);
    return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });
  }

  const anon = createAnonClient();
  const { data, error } = await anon.auth.signInWithPassword({ email, password });

  if (error || !data.user || !data.session) {
    await recordAuthAttempt(ip, 'login', false);
    return NextResponse.json({ error: 'E-posta veya şifre hatalı' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('is_banned')
    .eq('id', data.user.id)
    .maybeSingle();

  if ((profile as { is_banned: boolean | null } | null)?.is_banned) {
    await anon.auth.signOut();
    await recordAuthAttempt(ip, 'login', false);
    return NextResponse.json({ error: 'Hesabınız yönetici tarafından askıya alınmıştır.' }, { status: 403 });
  }

  await recordAuthAttempt(ip, 'login', true);
  return NextResponse.json({
    ok: true,
    session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
  });
}
