import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/utils/supabase/server-anon';
import { checkPasswordResetLimit, getClientIp, recordAuthAttempt } from '@/app/src/lib/authSecurity';

// "Şifremi unuttum" (2026-10-03). Tarayıcıdan doğrudan değil buradan: Supabase'in e-posta sınırı
// TÜM site için saatte 30, IP başına sınır olmadan tek kişi herkesin sıfırlama e-postasını
// durdurabilir. E-postalar Resend SMTP ile noreply@derstakip.net'ten gider (Supabase Auth ayarı).
//
// E-postadaki bağlantı şablonda /auth/confirm?token_hash=…&type=recovery biçiminde — Supabase'in
// varsayılan PKCE bağlantısı isteğin yapıldığı tarayıcıya bağlı olduğundan, istek bilgisayardan
// yapılıp e-posta telefonda açılınca çalışmıyordu (bkz. app/auth/confirm/route.ts).
//
// Hesabın var olup olmadığı yanıttan anlaşılmaz (e-posta keşfi önlemi): her geçerli istekte ok.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = await checkPasswordResetLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Çok fazla istek yapıldı. ${Math.ceil(limit.retryAfterSeconds / 60)} dakika sonra tekrar dener misin?` },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Geçerli bir e-posta adresi yaz.' }, { status: 400 });
  }

  await recordAuthAttempt(ip, 'password_reset', true);
  const { error } = await createAnonClient().auth.resetPasswordForEmail(email);
  // Kullanıcı bulunamadı vb. durumlar sızdırılmaz; yalnız Supabase'in kendi sınırı ayrıca bildirilir.
  if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
    return NextResponse.json({ error: 'Şu an çok fazla e-posta gönderiliyor. Biraz sonra tekrar dener misin?' }, { status: 429 });
  }
  if (error) console.error('[password-reset] resetPasswordForEmail hatası:', error.message);
  return NextResponse.json({ ok: true });
}
