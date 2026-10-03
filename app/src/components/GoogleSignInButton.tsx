'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { GoogleIcon, authStyles as s } from '@/app/src/components/auth/AuthShell';

// Google OAuth akışı bir sayfa yönlendirmesi (redirect) ile çalışır: burada oturum
// hemen oluşmaz, tarayıcı Google'a gider, kullanıcı onaylar, sonra Supabase onu
// /auth/callback route'umuza geri yollar (bkz. app/auth/callback/route.ts) — o route
// kodu oturuma çevirip asıl hedefe (redirectTo) yönlendirir. Dönüş adresi Supabase Auth'un
// izin listesinde olmalı (https://www.derstakip.net/** — 2026-10-03'te eklendi; öncesinde liste
// yalnız eski mobil uygulamanın adreslerini içeriyordu).
export default function GoogleSignInButton({ redirectTo = '/', label = 'Google ile devam et' }: { redirectTo?: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (oauthError) {
      setError('Google ile giriş başlatılamadı, lütfen tekrar dene.');
      setLoading(false);
    }
    // Başarılıysa tarayıcı zaten Google'a yönlendirilir, loading state'ini sıfırlamaya gerek yok.
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={loading} className={`${s.btn} ${s.ghost}`}>
        <GoogleIcon />
        {loading ? 'Yönlendiriliyor…' : label}
      </button>
      {error && <p role="alert" className={s.hint} style={{ color: 'var(--err)', marginTop: 8 }}>{error}</p>}
    </div>
  );
}
