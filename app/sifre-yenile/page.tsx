'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../src/context/AuthContext';
import { AuthBanner, AuthLoading, AuthShell, authStyles as s } from '../src/components/auth/AuthShell';
import { PasswordField } from '../src/components/auth/PasswordField';
import { MIN_PASSWORD_LENGTH } from '@/app/src/lib/password';
import { offerToSaveCredential } from '@/app/src/lib/browserCredentials';

// Yeni şifre belirleme (2026-10-03). E-postadaki bağlantı /auth/confirm'den geçip oturumu açar ve
// buraya getirir; oturum yoksa (bağlantı açılmadan doğrudan gelindiyse) yeni bağlantı istenir.
// Giriş yapmış kullanıcı da buradan şifresini değiştirebilir.
export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading, supabase } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) return <AuthLoading />;

  if (!user) {
    return (
      <AuthShell>
        <div className={s.form}>
          <div>
            <h1 className={s.title}>Bağlantı geçersiz</h1>
            <p className={s.lead}>Bu sayfaya e-postadaki şifre sıfırlama bağlantısıyla gelmelisin. Bağlantının süresi dolmuş ya da daha önce kullanılmış olabilir.</p>
          </div>
          <Link href="/sifremi-unuttum" className={`${s.btn} ${s.primary}`}>Yeni bağlantı iste</Link>
          <p className={s.foot}><Link href="/login" className={s.link}>Girişe dön</Link></p>
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
    if (password !== confirm) return setError('Şifreler eşleşmiyor.');
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      const msg = updateError.message.toLowerCase();
      setError(
        msg.includes('different from the old')
          ? 'Yeni şifren eskisinden farklı olmalı.'
          : msg.includes('password')
            ? `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`
            : 'Şifre güncellenemedi. Bağlantının süresi dolmuş olabilir, yeni bağlantı isteyebilirsin.'
      );
      return;
    }
    if (user.email) await offerToSaveCredential(user.email, password);
    setDone(true);
    setTimeout(() => router.replace('/'), 1500);
  };

  return (
    <AuthShell>
      <form className={s.form} onSubmit={handleSubmit}>
        <div>
          <h1 className={s.title}>Yeni şifreni belirle</h1>
          <p className={s.lead}>{user.email ? <><b>{user.email}</b> hesabı için yeni şifreni yaz.</> : 'Yeni şifreni yaz.'}</p>
        </div>
        {/* Tarayıcının şifre yöneticisi şifreyi doğru hesaba kaydetsin diye gizli kimlik alanı. */}
        <input type="email" name="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
        <PasswordField
          id="new-password"
          label="Yeni şifre"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="En az 8 karakter"
          showStrength
          onGenerate={(pwd) => { setPassword(pwd); setConfirm(pwd); }}
        />
        <PasswordField
          id="confirm-password"
          label="Yeni şifre (tekrar)"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          placeholder="Aynısını yaz"
          invalid={!!confirm && confirm !== password}
        />
        {error && <AuthBanner kind="err" onClose={() => setError(null)}>{error}</AuthBanner>}
        {done && <AuthBanner kind="ok">Şifren güncellendi. Seni anasayfaya götürüyoruz…</AuthBanner>}
        <button type="submit" className={`${s.btn} ${s.primary}`} disabled={saving || done}>
          {saving ? 'Kaydediliyor…' : 'Şifremi güncelle'}
        </button>
      </form>
    </AuthShell>
  );
}
