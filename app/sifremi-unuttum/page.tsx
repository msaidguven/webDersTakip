'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthBanner, AuthLoading, AuthShell, authStyles as s } from '../src/components/auth/AuthShell';

// "Şifremi unuttum" (2026-10-03). İstek /api/auth/password-reset üzerinden gider (IP sınırı);
// e-postadaki bağlantı /auth/confirm → /sifre-yenile. Hesabın varlığı belli edilmez: geçerli her
// istekte aynı "e-postanı kontrol et" ekranı gösterilir.
function ForgotForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams?.get('email') ?? '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'İstek gönderilemedi, tekrar dener misin?');
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İstek gönderilemedi, tekrar dener misin?');
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return (
      <AuthShell>
        <div className={s.form} role="status">
          <div>
            <h1 className={s.title}>E-postanı kontrol et</h1>
            <p className={s.lead}>
              <b>{email.trim()}</b> adresine kayıtlı bir hesap varsa şifre sıfırlama bağlantısını gönderdik. Bağlantı 1 saat geçerli.
            </p>
          </div>
          <p className={s.hint}>E-posta birkaç dakika içinde gelmediyse istenmeyen (spam) klasörüne bak. Hâlâ yoksa adresi kontrol edip tekrar isteyebilirsin.</p>
          <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => setStatus('idle')}>Tekrar gönder</button>
          <p className={s.foot}><Link href="/login" className={s.link}>Girişe dön</Link></p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form className={s.form} onSubmit={handleSubmit}>
        <div>
          <h1 className={s.title}>Şifreni mi unuttun?</h1>
          <p className={s.lead}>Hesabının e-posta adresini yaz, yeni şifre belirlemen için bir bağlantı gönderelim.</p>
        </div>
        <div className={s.field}>
          <label htmlFor="email" className={s.label}>E-posta</label>
          <input
            id="email"
            name="email"
            type="email"
            className={s.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ornek@eposta.com"
            required
            autoFocus
          />
        </div>
        {error && <AuthBanner kind="err" onClose={() => setError(null)}>{error}</AuthBanner>}
        <button type="submit" className={`${s.btn} ${s.primary}`} disabled={status === 'sending'}>
          {status === 'sending' ? 'Gönderiliyor…' : 'Bağlantıyı gönder'}
        </button>
        <p className={s.foot}><Link href="/login" className={s.link}>Girişe dön</Link></p>
      </form>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <ForgotForm />
    </Suspense>
  );
}
