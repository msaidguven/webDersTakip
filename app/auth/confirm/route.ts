import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { safeRedirectPath } from '@/app/src/lib/safeRedirect';

// E-postadaki bağlantıların doğrulandığı yer (şimdilik şifre sıfırlama, 2026-10-03). Supabase'in
// e-posta şablonu bağlantıyı {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/sifre-yenile
// biçiminde verir. verifyOtp token_hash ile çalıştığı için isteğin yapıldığı tarayıcıdan bağımsızdır
// (PKCE'deki "code verifier" o tarayıcıda kalıyordu). Başarılıysa oturum çerezleri yazılır ve
// kullanıcı next'e gider; bağlantı geçersiz/süresi dolmuşsa giriş sayfasında açıklanır.
const ALLOWED_TYPES: EmailOtpType[] = ['recovery', 'email', 'signup', 'invite', 'magiclink', 'email_change'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get('next') || '/', '/');

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
