'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLoginViewModel } from '../src/viewmodels/useLoginViewModel';
import { useAuth } from '../src/context/AuthContext';
import GoogleSignInButton from '../src/components/GoogleSignInButton';
import { AuthBanner, AuthLoading, AuthShell, authStyles as s } from '../src/components/auth/AuthShell';
import { PasswordField } from '../src/components/auth/PasswordField';
import { safeRedirectPath } from '@/app/src/lib/safeRedirect';
import { offerToSaveCredential } from '@/app/src/lib/browserCredentials';

// /auth/callback'in giriş sayfasına geri gönderdiği hata kodları (bkz. app/auth/callback/route.ts).
const CALLBACK_ERRORS: Record<string, string> = {
  oauth: 'Google ile giriş tamamlanamadı. Tekrar dener misin?',
  profile_creation_failed: 'Hesabın oluşturulurken bir sorun oldu. Biraz sonra tekrar dener misin?',
  link_expired: 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Yeni bir bağlantı isteyebilirsin.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Açık yönlendirme önlemi: sadece site içi göreli yollar (bkz. safeRedirect.ts).
  const rawRedirectTo = searchParams?.get('redirectTo');
  const explicitRedirectTo = rawRedirectTo ? safeRedirectPath(rawRedirectTo, '') || null : null;
  const callbackError = CALLBACK_ERRORS[searchParams?.get('error') ?? ''] ?? null;

  const { isAuthenticated, loading, user, supabase } = useAuth();
  const { state, login, clearError } = useLoginViewModel();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showCallbackError, setShowCallbackError] = useState(true);

  // Giriş yapmış kullanıcıyı TEK yerden yönlendir: açık redirectTo varsa oraya, yoksa öğretmen
  // /ogretmen'e, öğrenci anasayfaya.
  useEffect(() => {
    if (loading || !isAuthenticated || !user) return;
    if (explicitRedirectTo) {
      router.replace(explicitRedirectTo);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!cancelled) router.replace((data as { role: string } | null)?.role === 'teacher' ? '/ogretmen' : '/');
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loading, router, explicitRedirectTo, user, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowCallbackError(false);
    if (await login({ email: email.trim(), password })) {
      void offerToSaveCredential(email.trim(), password);
    }
  };

  if (loading || isAuthenticated) return <AuthLoading text="Yönlendiriliyor…" />;

  const registerHref = explicitRedirectTo ? `/register?redirectTo=${encodeURIComponent(explicitRedirectTo)}` : '/register';
  const forgotHref = email.trim() ? `/sifremi-unuttum?email=${encodeURIComponent(email.trim())}` : '/sifremi-unuttum';

  return (
    <AuthShell>
      <form className={s.form} onSubmit={handleSubmit}>
        <div>
          <h1 className={s.title}>Tekrar hoş geldin</h1>
          <p className={s.lead}>Kaldığın yerden devam etmek için giriş yap.</p>
        </div>

        {callbackError && showCallbackError && (
          <AuthBanner kind="err" onClose={() => setShowCallbackError(false)}>{callbackError}</AuthBanner>
        )}

        <div className={s.field}>
          <label htmlFor="email" className={s.label}>E-posta</label>
          <input
            id="email"
            name="email"
            type="email"
            className={s.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            // username: tarayıcı şifre yöneticisi bu alanı hesabın kimliği olarak kaydetsin.
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ornek@eposta.com"
            required
          />
        </div>

        <PasswordField
          id="password"
          label="Şifre"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Şifren"
          labelAside={<Link href={forgotHref} className={s.link}>Şifremi unuttum</Link>}
        />

        {state.error && <AuthBanner kind="err" onClose={clearError}>{state.error}</AuthBanner>}

        <button type="submit" className={`${s.btn} ${s.primary}`} disabled={state.isLoading}>
          {state.isLoading ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>

        <div className={s.or}>veya</div>
        <GoogleSignInButton redirectTo={explicitRedirectTo || '/'} />

        <p className={s.foot}>
          Hesabın yok mu? <Link href={registerHref} className={s.link}>Kayıt ol</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <LoginForm />
    </Suspense>
  );
}
