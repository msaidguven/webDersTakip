import { NextRequest, NextResponse } from 'next/server';
import { createServerClient as createServiceClient } from '@/utils/supabase/server-public';
import { hashToken, VERIFY_TTL_MS } from '@/app/src/lib/emailVerification';

// E-postadaki doğrulama bağlantısı (bkz. lib/emailVerification.ts). Oturum gerektirmez (bağlantı başka cihazda
// açılabilir): anahtar tek kullanımlık, 24 saat geçerli. Sonuç profile ?eposta=… ile döner.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('t') ?? '';
  const back = (status: string) => NextResponse.redirect(new URL(`/profil?eposta=${status}`, request.url));
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return back('gecersiz');

  const service = createServiceClient();
  const { data } = await service.from('profiles').select('id, email_verify_sent_at').eq('email_verify_token_hash', hashToken(token)).maybeSingle();
  const row = data as { id: string; email_verify_sent_at: string | null } | null;
  if (!row) return back('gecersiz');
  if (!row.email_verify_sent_at || Date.now() - Date.parse(row.email_verify_sent_at) > VERIFY_TTL_MS) return back('suresi-doldu');

  const { error } = await service
    .from('profiles')
    .update({ email_verified_at: new Date().toISOString(), email_verify_token_hash: null })
    .eq('id', row.id);
  return back(error ? 'gecersiz' : 'dogrulandi');
}
